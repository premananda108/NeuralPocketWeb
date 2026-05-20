import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';

/**
 * Strip Gemma chat-template special tokens from the accumulated output.
 */
function cleanGemmaOutput(text: string): string {
  return text
    .replace(/<start_of_turn>[^<]*<\/start_of_turn>/g, '')
    .replace(/<start_of_turn>\w*\n?/g, '')
    .replace(/<\/?(?:start|end)_of_turn>/g, '')
    .replace(/<(?:bos|eos)>/g, '')
    .replace(/^[\s\n]+/, '');
}

export const DEFAULT_MODEL_URL =
  'https://pub-b07512464f924792a1bb4c7b3571db1e.r2.dev/gemma-4-E2B-it-web.task';

export const MODELS_LIST = [
  {
    id: 'gemma-4-e2b',
    name: 'Gemma 4 E2B',
    description: 'Balanced size & performance (~2 GB)',
    url: 'https://pub-b07512464f924792a1bb4c7b3571db1e.r2.dev/gemma-4-E2B-it-web.task',
  },
  {
    id: 'gemma-4-e4b',
    name: 'Gemma 4 E4B',
    description: 'High-quality reasoning (~3 GB)',
    url: 'https://pub-b07512464f924792a1bb4c7b3571db1e.r2.dev/gemma-4-E4B-it-web.task',
  },
  {
    id: 'gemma-3n-e2b-vision-audio',
    name: 'Gemma 3 Multimodal',
    description: 'Supports text, images, and audio files (~3 GB)',
    url: 'https://pub-b07512464f924792a1bb4c7b3571db1e.r2.dev/gemma-3n-E2B-it-int4-Web.litertlm',
  }
];

export type ModelStatus =
  | 'idle'
  | 'checking-cache'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'error';

export interface ModelProgress {
  stage: string;
  downloadedMB: number;
  totalMB: number;
  percent: number;
}

export interface UseGemmaModelReturn {
  status: ModelStatus;
  progress: ModelProgress;
  error: string | null;
  streamingText: string;
  isGenerating: boolean;
  selectedModelUrl: string;
  selectModel: (url: string) => void;
  initModel: (modelUrl?: string) => void;
  /** systemPrompt is now passed per-call, not stored globally */
  sendPrompt: (text: string, imageBase64?: string, audioRaw?: Float32Array, systemPrompt?: string) => void;
  abortGeneration: () => void;
  resetChat: () => void;
  clearModelCache: (modelUrl?: string) => void;
}

const SELECTED_MODEL_KEY = 'gemma_selected_model_url';

/**
 * Utility to decode any audio File/Blob into a resampled mono 16kHz PCM Float32Array on the main thread.
 * Resampling is handled automatically by the browser's hardware-accelerated AudioContext.
 */
export async function decodeAudioFile(fileOrBlob: Blob): Promise<Float32Array> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this browser.');
  }
  const audioCtx = new AudioContextClass({
    sampleRate: 16000,
  });

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const pcmData = audioBuffer.getChannelData(0);
    // Create a new Float32Array to ensure it owns its underlying buffer for worker transferring
    return new Float32Array(pcmData);
  } finally {
    await audioCtx.close();
  }
}

export function useGemmaModel(): UseGemmaModelReturn {
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [progress, setProgress] = useState<ModelProgress>({
    stage: '',
    downloadedMB: 0,
    totalMB: 0,
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedModelUrl, setSelectedModelUrlState] = useState<string>(
    () => localStorage.getItem(SELECTED_MODEL_KEY) || DEFAULT_MODEL_URL
  );

  const workerRef = useRef<Worker | null>(null);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/ai-worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent) => {
      const { type } = event.data;
      console.log(`[Model Hook] ← ${type}`, event.data);

      switch (type) {
        case 'STATUS':
          setStatus(event.data.status as ModelStatus);
          setProgress((prev) => ({ ...prev, stage: event.data.stage }));
          break;

        case 'DOWNLOAD_PROGRESS':
          setProgress({
            stage: 'Downloading AI model...',
            downloadedMB: event.data.downloadedMB,
            totalMB: event.data.totalMB,
            percent: event.data.percent,
          });
          break;

        case 'INIT_DONE':
          setStatus('ready');
          setProgress((prev) => ({ ...prev, stage: 'Model ready!' }));
          break;

        case 'INIT_ERROR':
          setStatus('error');
          setError(event.data.error);
          break;

        case 'CHUNK':
          setStreamingText((prev) => cleanGemmaOutput(prev + event.data.text));
          break;

        case 'DONE':
          setIsGenerating(false);
          break;

        case 'ERROR':
          setIsGenerating(false);
          setError(event.data.error);
          break;

        case 'CACHE_CLEARED':
          setStatus('idle');
          setProgress({ stage: '', downloadedMB: 0, totalMB: 0, percent: 0 });
          setError(null);
          break;
      }
    };

    worker.onerror = (err) => {
      setStatus('error');
      setError(`Worker error: ${err.message}`);
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const initModel = useCallback(
    (modelUrl: string = selectedModelUrl) => {
      if (status === 'checking-cache' || status === 'downloading' || status === 'initializing') {
        return;
      }
      setError(null);
      workerRef.current?.postMessage({ type: 'INIT', modelUrl });
    },
    [status, selectedModelUrl]
  );

  const selectModel = useCallback((url: string) => {
    setSelectedModelUrlState(url);
    localStorage.setItem(SELECTED_MODEL_KEY, url);
    setError(null);
    setStatus('idle');
    workerRef.current?.postMessage({ type: 'INIT', modelUrl: url });
  }, []);

  /**
   * Send a prompt. systemPrompt is passed per-call so each chat can have its own.
   * Falls back to DEFAULT_SYSTEM_PROMPT if not provided.
   */
  const sendPrompt = useCallback(
    (text: string, imageBase64?: string, audioRaw?: Float32Array, systemPrompt?: string) => {
      if (status !== 'ready' || !workerRef.current) return;
      setStreamingText('');
      setIsGenerating(true);
      setError(null);

      // Using Transferable Objects to transfer the underlying PCM ArrayBuffer with 0-copy overhead
      const transferables = audioRaw ? [audioRaw.buffer] : [];

      workerRef.current.postMessage({
        type: 'PROMPT',
        text,
        imageBase64,
        audioRaw,
        systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      }, transferables);
    },
    [status]
  );

  const abortGeneration = useCallback(() => {
    workerRef.current?.postMessage({ type: 'ABORT' });
    setIsGenerating(false);
  }, []);

  const resetChat = useCallback(() => {
    setStreamingText('');
    setError(null);
    setIsGenerating(false);
  }, []);

  const clearModelCache = useCallback((modelUrl?: string) => {
    workerRef.current?.postMessage({ type: 'CLEAR_CACHE', modelUrl });
  }, []);

  return {
    status,
    progress,
    error,
    streamingText,
    isGenerating,
    selectedModelUrl,
    selectModel,
    initModel,
    sendPrompt,
    abortGeneration,
    resetChat,
    clearModelCache,
  };
}
