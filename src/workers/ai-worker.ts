// src/workers/ai-worker.ts
// Vite-bundled Web Worker for on-device AI inference.
// Loads MediaPipe dynamically from jsDelivr CDN to keep the project clean.

import type { LlmInference } from '@mediapipe/tasks-genai'
import { DEFAULT_SYSTEM_PROMPT } from '../constants'
import { getCacheFilename } from '../utils/chatHelpers'

let FilesetResolver: any = null
let LlmInferenceClass: any = null

let llmInstance: LlmInference | null = null
let currentModelUrl: string | null = null
let isInitializing = false
let isGenerating = false
let activeBlobUrl: string | null = null

// Fix for MediaPipe dynamic import in Module Workers
if (typeof (self as any).import === 'undefined') {
  (self as any).import = async (path: string) => {
    console.log(`[AI Worker] Polyfilling self.import: fetching and evaluating ${path}`);
    const url = path.startsWith('http') ? path : new URL(path, self.location.origin).href;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch script at ${url}: ${response.statusText}`);
    }
    const code = await response.text();
    (0, eval)(code);
    return {};
  };
}

// Fix for MediaPipe ReferenceErrors in Web Workers (HTML DOM elements are missing in background threads)
if (typeof (self as any).HTMLImageElement === 'undefined') {
  (self as any).HTMLImageElement = class {};
}
if (typeof (self as any).HTMLVideoElement === 'undefined') {
  (self as any).HTMLVideoElement = class {};
}
if (typeof (self as any).VideoFrame === 'undefined') {
  (self as any).VideoFrame = class {};
}
if (typeof (self as any).AudioContext === 'undefined') {
  (self as any).AudioContext = class {};
}

// ─── Message handler ───────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const { type, modelUrl, text, imageBase64, audioRaw, systemPrompt, history } = event.data
  console.log(`[AI Worker] Received event: ${type}`, { modelUrl })

  switch (type) {
    case 'INIT':
      await handleInit(modelUrl)
      break
    case 'PROMPT':
      await handlePrompt(text, imageBase64, audioRaw, systemPrompt, history)
      break
    case 'ABORT':
      isGenerating = false
      break
    case 'CLEAR_CACHE':
      await clearCache(modelUrl)
      break
  }
}

// ─── OPFS cache helpers ────────────────────────────────────────────────────


async function getModelFromOPFS(cacheFilename: string): Promise<File | null> {
  let retries = 3
  while (retries > 0) {
    try {
      const root = await navigator.storage.getDirectory()
      const fileHandle = await root.getFileHandle(cacheFilename)
      const file = await fileHandle.getFile()
      if (file.size > 100_000) {
        console.log(`[AI Worker] Found cached model: ${cacheFilename} (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
        return file
      }
      return null
    } catch (err: any) {
      console.warn(`[AI Worker] getModelFromOPFS failed (attempts left: ${retries - 1}):`, err)
      if (err?.name === 'InvalidStateError' || err?.message?.includes('state cached')) {
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
      }
      break
    }
  }
  return null
}

async function downloadAndCacheModel(modelUrl: string, cacheFilename: string): Promise<File> {
  const response = await fetch(modelUrl)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('text/html')) {
    throw new Error(`Invalid model URL: server returned HTML. Make sure the model file exists at: ${modelUrl}`)
  }

  const contentLength = parseInt(response.headers.get('Content-Length') || '0')
  const totalMB = contentLength > 0 ? contentLength / 1_048_576 : 0

  const root = await navigator.storage.getDirectory()
  // Ensure the file is created first
  const fileHandle = await root.getFileHandle(cacheFilename, { create: true })

  // Open high-performance sync access handle
  let accessHandle: any
  let retries = 3
  while (retries > 0) {
    try {
      accessHandle = await (fileHandle as any).createSyncAccessHandle()
      break
    } catch (err: any) {
      console.warn(`[AI Worker] Failed to acquire sync access handle (attempts left: ${retries - 1}):`, err)
      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
        continue
      }
      throw err
    }
  }

  // Clear any existing content in the file first to ensure we write from scratch
  try {
    accessHandle.truncate(0)
  } catch (err) {
    console.warn('[AI Worker] Truncate failed, continuing:', err)
  }

  const reader = response.body!.getReader()
  let receivedBytes = 0
  let lastReport = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Write chunk at the current offset
      accessHandle.write(value, { at: receivedBytes })
      receivedBytes += value.byteLength
      const now = Date.now()
      if (now - lastReport > 400) {
        lastReport = now
        self.postMessage({
          type: 'DOWNLOAD_PROGRESS',
          downloadedMB: receivedBytes / 1_048_576,
          totalMB,
          percent: contentLength > 0 ? (receivedBytes / contentLength) * 100 : 0,
        })
      }
    }
    accessHandle.flush()
    accessHandle.close()
    console.log(`[AI Worker] Download complete: ${cacheFilename} (${(receivedBytes / 1_048_576).toFixed(1)} MB)`)
  } catch (error) {
    try {
      accessHandle.close()
    } catch { /* ignore */ }
    try {
      await root.removeEntry(cacheFilename)
    } catch { /* ignore */ }
    throw error
  }

  const freshFileHandle = await root.getFileHandle(cacheFilename)
  return await freshFileHandle.getFile()
}

async function clearCache(modelUrl?: string) {
  try {
    const root = await navigator.storage.getDirectory()
    if (modelUrl) {
      await root.removeEntry(getCacheFilename(modelUrl))
    } else {
      const knownExtensions = ['.task', '.litertlm', '.bin']
      // @ts-ignore - values() is available on OPFS directory handles
      for await (const entry of root.values()) {
        if (entry.kind === 'file') {
          const isModelFile = knownExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))
          if (isModelFile) {
            await root.removeEntry(entry.name)
          }
        }
      }
    }
    self.postMessage({ type: 'CACHE_CLEARED' })
  } catch {
    self.postMessage({ type: 'CACHE_CLEARED' })
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

async function handleInit(modelUrl: string) {
  if (isInitializing) {
    console.log('[AI Worker] Already initializing, skipping')
    return
  }

  if (llmInstance) {
    if (currentModelUrl === modelUrl) {
      console.log('[AI Worker] Same model already loaded')
      self.postMessage({ type: 'INIT_DONE' })
      return
    }
    console.log('[AI Worker] Switching model, closing previous...')
    try { llmInstance.close(); llmInstance = null } catch { /* ignore */ }
  }

  isInitializing = true
  const cacheFilename = getCacheFilename(modelUrl)
  console.log(`[AI Worker] Cache filename: "${cacheFilename}" for "${modelUrl}"`)

  try {
    // 1. Check OPFS cache
    self.postMessage({ type: 'STATUS', status: 'checking-cache', stage: `Checking cache for ${cacheFilename}...` })
    let modelFile = await getModelFromOPFS(cacheFilename)

    // 2. Download if not cached
    if (!modelFile) {
      self.postMessage({ type: 'STATUS', status: 'downloading', stage: 'Downloading AI model...' })
      modelFile = await downloadAndCacheModel(modelUrl, cacheFilename)
    }

    // 3. Create blob URL for MediaPipe
    const blobUrl = URL.createObjectURL(modelFile)

    // 4. Check WebGPU
    self.postMessage({ type: 'STATUS', status: 'initializing', stage: 'Checking GPU support...' })
    if (!('gpu' in navigator)) {
      throw new Error(
        'WebGPU is not supported.\nPlease use Chrome 113+ and enable:\nchrome://flags/#enable-webgpu-developer-features'
      )
    }
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      throw new Error(
        'WebGPU adapter unavailable.\n\nFix in Chrome:\n' +
        '1. chrome://settings/system → Enable "Use hardware acceleration"\n' +
        '2. chrome://flags/#enable-webgpu-developer-features → Enabled\n' +
        '3. Relaunch Chrome'
      )
    }
    console.log('[AI Worker] WebGPU OK:', (adapter as any).info?.vendor ?? 'unknown')

    if (!adapter.features.has('shader-f16')) {
      console.warn("[AI Worker] WebGPU feature 'shader-f16' is not supported by this GPU/driver. MediaPipe will fall back to FP32 computations.");
    }

    // 5. Load MediaPipe fileset from jsDelivr CDN
    self.postMessage({ type: 'STATUS', status: 'initializing', stage: 'Loading AI runtime...' })
    if (!FilesetResolver || !LlmInferenceClass) {
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/genai_bundle.mjs'
      const module = await import(/* @vite-ignore */ cdnUrl)
      FilesetResolver = module.FilesetResolver
      LlmInferenceClass = module.LlmInference
    }
    const genaiFileset = await FilesetResolver.forGenAiTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm')

    // 6. Initialize LlmInference with the cached model
    self.postMessage({ type: 'STATUS', status: 'initializing', stage: 'Initializing Gemma on GPU...' })
    llmInstance = await LlmInferenceClass.createFromOptions(genaiFileset, {
      baseOptions: { modelAssetPath: blobUrl },
      maxTokens: 2048,
      temperature: 0.7,
      maxNumImages: 1, // Enable multimodal (vision) support in the engine
      supportAudio: true, // Enable multimodal (audio) support in the engine
    })

    // Revoke previous blob URL if it exists
    if (activeBlobUrl) {
      try { URL.revokeObjectURL(activeBlobUrl) } catch {}
    }
    activeBlobUrl = blobUrl // Keep active to prevent net::ERR_FILE_NOT_FOUND in subsequent reads

    currentModelUrl = modelUrl
    isInitializing = false
    self.postMessage({ type: 'INIT_DONE' })

  } catch (error: any) {
    isInitializing = false
    console.error('[AI Worker] Init error:', error)
    
    let userFriendlyError = error?.message ?? String(error)
    if (
      userFriendlyError.includes('Audio options should not be null') ||
      userFriendlyError.includes('Audio input not supported') ||
      userFriendlyError.includes('Image input not supported') ||
      userFriendlyError.includes('LlmGpuCalculator') ||
      userFriendlyError.includes('CalculatorGraph::Run()') ||
      userFriendlyError.includes('LlmGpuRunnerManager')
    ) {
      userFriendlyError = 'This AI model does not support image or audio inputs. Please switch to a multimodal-compatible model or use a text-only prompt.'
    }
    
    self.postMessage({ type: 'INIT_ERROR', error: userFriendlyError })
  }
}

// ─── Inference ─────────────────────────────────────────────────────────────

// Strip Gemma control tokens from streaming output
const GEMMA_TOKEN_RE = /<start_of_turn>[\s\S]*?<\/start_of_turn>|<\/?(?:start|end)_of_turn>|<(?:bos|eos)>/g

function stripControlTokens(text: string): string {
  return text.replace(GEMMA_TOKEN_RE, '').replace(/^\n+/, '')
}

async function base64ToImageBitmap(base64Str: string): Promise<ImageBitmap> {
  const base64Data = base64Str.split(',')[1] || base64Str
  const binaryStr = atob(base64Data)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'image/png' })
  return await createImageBitmap(blob)
}

async function handlePrompt(
  userText: string,
  imageBase64?: string,
  audioRaw?: Float32Array,
  systemPrompt?: string,
  history?: { role: 'user' | 'ai'; text: string }[]
) {
  if (!llmInstance || isGenerating) return
  isGenerating = true

  const sysPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT
  let imageBitmap: ImageBitmap | null = null
  let prompt: string | any[] = ''

  try {
    let hasMultimodal = false
    if (imageBase64 || audioRaw) {
      hasMultimodal = true
    }

    if (hasMultimodal) {
      const promptParts: any[] = []

      // If history is present, format history turns with system prompt in the first user turn
      if (history && history.length > 0) {
        const recentHistory = history.slice(-20)
        recentHistory.forEach((msg, idx) => {
          if (msg.role === 'user') {
            const content = idx === 0 ? `${sysPrompt}\n\n${msg.text}` : msg.text
            promptParts.push(`<start_of_turn>user\n${content}\n<end_of_turn>\n`)
          } else {
            promptParts.push(`<start_of_turn>model\n${msg.text}\n<end_of_turn>\n`)
          }
        })

        // Current turn begins as a fresh user turn containing only the current media inputs
        promptParts.push(`<start_of_turn>user\n`)
        if (imageBase64) {
          try {
            imageBitmap = await base64ToImageBitmap(imageBase64)
            promptParts.push({ imageSource: imageBitmap })
          } catch (err) {
            console.error('[AI Worker] Failed to convert image to ImageBitmap:', err)
            promptParts.push(`\n[Failed to load image]\n`)
          }
        }
        if (audioRaw) {
          promptParts.push({
            audioSource: {
              audioSamples: audioRaw,
              audioSampleRateHz: 16000,
            }
          })
        }
        promptParts.push(`\n${userText || 'Describe the input.'}\n<end_of_turn>\n<start_of_turn>model\n`)
      } else {
        // No history: single turn starting with the system prompt, containing the media inputs and user query
        promptParts.push(`<start_of_turn>user\n${sysPrompt}\n\n`)
        if (imageBase64) {
          try {
            imageBitmap = await base64ToImageBitmap(imageBase64)
            promptParts.push({ imageSource: imageBitmap })
          } catch (err) {
            console.error('[AI Worker] Failed to convert image to ImageBitmap:', err)
            promptParts.push(`\n[Failed to load image]\n`)
          }
        }
        if (audioRaw) {
          promptParts.push({
            audioSource: {
              audioSamples: audioRaw,
              audioSampleRateHz: 16000,
            }
          })
        }
        promptParts.push(`\n${userText || 'Describe the input.'}\n<end_of_turn>\n<start_of_turn>model\n`)
      }

      prompt = promptParts
    } else {
      // Pure text chat
      let promptText = ''

      if (history && history.length > 0) {
        const recentHistory = history.slice(-20)
        recentHistory.forEach((msg, idx) => {
          if (msg.role === 'user') {
            const content = idx === 0 ? `${sysPrompt}\n\n${msg.text}` : msg.text
            promptText += `<start_of_turn>user\n${content}\n<end_of_turn>\n`
          } else {
            promptText += `<start_of_turn>model\n${msg.text}\n<end_of_turn>\n`
          }
        })
        promptText += `<start_of_turn>user\n${userText}\n<end_of_turn>\n<start_of_turn>model\n`
      } else {
        promptText += `<start_of_turn>user\n${sysPrompt}\n\n${userText}\n<end_of_turn>\n<start_of_turn>model\n`
      }

      prompt = promptText
    }
  } catch (err) {
    console.error('[AI Worker] Failed to build multimodal prompt:', err)
    prompt =
      `<start_of_turn>user\n${sysPrompt}\n\n${userText}\n<end_of_turn>\n<start_of_turn>model\n`
  }

  let rawBuffer = ''
  let headerConsumed = false
  const HEADER_SUFFIX = '<start_of_turn>model\n'

  try {
    await (llmInstance as any).generateResponse(prompt, (partial: string, done: boolean) => {
      if (!isGenerating) return

      if (partial) {
        if (!headerConsumed) {
          rawBuffer += partial
          const headerEnd = rawBuffer.indexOf(HEADER_SUFFIX)
          if (headerEnd !== -1) {
            headerConsumed = true
            const clean = stripControlTokens(rawBuffer.slice(headerEnd + HEADER_SUFFIX.length))
            if (clean) self.postMessage({ type: 'CHUNK', text: clean })
            rawBuffer = ''
          }
        } else {
          const clean = stripControlTokens(partial)
          if (clean) self.postMessage({ type: 'CHUNK', text: clean })
        }
      }

      if (done) {
        if (!headerConsumed && rawBuffer) {
          const clean = stripControlTokens(rawBuffer)
          if (clean) self.postMessage({ type: 'CHUNK', text: clean })
        }
        if (imageBitmap) {
          try { imageBitmap.close() } catch { /* ignore */ }
          imageBitmap = null
        }
        isGenerating = false
        self.postMessage({ type: 'DONE' })
      }
    })
  } catch (error: any) {
    if (imageBitmap) {
      try { imageBitmap.close() } catch { /* ignore */ }
      imageBitmap = null
    }
    isGenerating = false
    console.error('[AI Worker] Prompt error:', error)
    
    let userFriendlyError = error?.message ?? String(error)
    if (
      userFriendlyError.includes('Audio options should not be null') ||
      userFriendlyError.includes('Audio input not supported') ||
      userFriendlyError.includes('Image input not supported') ||
      userFriendlyError.includes('LlmGpuCalculator') ||
      userFriendlyError.includes('CalculatorGraph::Run()') ||
      userFriendlyError.includes('LlmGpuRunnerManager')
    ) {
      userFriendlyError = 'This AI model does not support image or audio inputs. Please switch to a multimodal-compatible model or use a text-only prompt.'
    }
    
    self.postMessage({ type: 'ERROR', error: userFriendlyError })
  }
}

self.addEventListener('unload', () => {
  if (llmInstance) {
    console.log('[AI Worker] Cleaning up instance')
    try { llmInstance.close() } catch { /* ignore */ }
  }
  if (activeBlobUrl) {
    console.log('[AI Worker] Cleaning up active blob URL')
    try { URL.revokeObjectURL(activeBlobUrl) } catch { /* ignore */ }
  }
})
