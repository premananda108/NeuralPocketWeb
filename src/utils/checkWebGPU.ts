// src/utils/checkWebGPU.ts
// Early WebGPU availability check — runs on app startup before any heavy work.
// Mirrors the pattern used in the renderer's initWebGPU(), but at the UI level
// so the user sees a clear error immediately instead of discovering it after
// the model download finishes.

export interface WebGPUCheckResult {
  supported: boolean;
  error: string | null;
}

export async function checkWebGPU(): Promise<WebGPUCheckResult> {
  // 1. Check whether the WebGPU API exists at all in this browser
  if (!('gpu' in navigator)) {
    return {
      supported: false,
      error: 'WebGPU is not supported in this browser.',
    };
  }

  // 2. Request a physical GPU adapter
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: 'No GPU adapter available for WebGPU.',
      };
    }
  } catch (e) {
    return {
      supported: false,
      error: `WebGPU initialization failed: ${(e as Error).message}`,
    };
  }

  return { supported: true, error: null };
}
