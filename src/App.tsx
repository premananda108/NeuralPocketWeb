import { useState, useEffect } from 'react';
import OnboardingScreen from './components/OnboardingScreen';
import ModelDownloader from './components/ModelDownloader';
import ChatInterface from './components/ChatInterface';
import { useGemmaModel } from './hooks/useGemmaModel';
import { checkWebGPU } from './utils/checkWebGPU';

export default function App() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(
    () => localStorage.getItem('hasSeenOnboarding') === 'true'
  );
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  // ── WebGPU early check ──────────────────────────────────────────────────
  // Runs once on mount. If WebGPU is unavailable the user sees a clear error
  // screen immediately — before onboarding and before any model download starts.
  const [webGPUChecked, setWebGPUChecked] = useState(false);
  const [webGPUError, setWebGPUError] = useState<string | null>(null);

  useEffect(() => {
    checkWebGPU().then(({ supported, error }) => {
      if (!supported) setWebGPUError(error);
      setWebGPUChecked(true);
    });
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  const {
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
  } = useGemmaModel();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleStart = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
  };

  const currentScreen = !webGPUChecked
    ? 'checking'
    : webGPUError
      ? 'webgpu-error'
      : !hasSeenOnboarding
        ? 'onboarding'
        : status === 'ready'
          ? 'chat'
          : 'loading';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* 'checking' renders nothing — the WebGPU check resolves in milliseconds */}
      {currentScreen === 'checking' && null}

      {currentScreen === 'webgpu-error' && (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 20px', background: 'var(--bg)', position: 'relative', overflow: 'hidden',
        }}>
          {/* bg glow */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', top: '15%', right: '20%',
              width: 300, height: 300, borderRadius: '50%',
              background: 'rgba(255,82,82,0.04)', filter: 'blur(80px)',
            }} />
          </div>

          <div style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 440,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          }}>
            {/* Icon */}
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>
              🎮
            </div>

            {/* Title + subtitle */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#FF5252', marginBottom: 8 }}>
                WebGPU Required
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360 }}>
                NeuralPocket runs AI entirely on your device — which requires WebGPU,
                a modern browser GPU feature.
              </p>
            </div>

            {/* Error detail */}
            <div className="tg-card" style={{ padding: '14px 18px', width: '100%', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Error details
              </div>
              <p style={{ fontSize: 13, color: '#FF5252', fontFamily: 'monospace', wordBreak: 'break-word', lineHeight: 1.5 }}>
                {webGPUError}
              </p>
            </div>

            {/* Fix instructions */}
            <div className="tg-card" style={{ padding: '16px 20px', width: '100%', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                🔧 How to fix
              </div>
              <ol style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 2, margin: 0 }}>
                <li>Use <strong style={{ color: 'var(--text-primary)' }}>Chrome 113+</strong> or <strong style={{ color: 'var(--text-primary)' }}>Edge 113+</strong></li>
                <li>
                  Open{' '}
                  <code style={{ color: '#2AABEE', background: 'rgba(42,171,238,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>
                    chrome://settings/system
                  </code>
                  {' '}→ enable <strong style={{ color: 'var(--text-primary)' }}>Hardware Acceleration</strong>
                </li>
                <li>
                  Open{' '}
                  <code style={{ color: '#2AABEE', background: 'rgba(42,171,238,0.1)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>
                    chrome://flags/#enable-webgpu-developer-features
                  </code>
                  {' '}→ <strong style={{ color: 'var(--text-primary)' }}>Enabled</strong>
                </li>
                <li>Relaunch Chrome and try again</li>
              </ol>
            </div>

            {/* Retry button */}
            <button
              onClick={() => window.location.reload()}
              className="tg-btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: 15, borderRadius: 12 }}
            >
              Retry after fixing →
            </button>
          </div>
        </div>
      )}

      {currentScreen === 'onboarding' && (
        <OnboardingScreen onContinue={handleStart} />
      )}

      {currentScreen === 'loading' && (
        <ModelDownloader
          status={status}
          progress={progress}
          error={error}
          selectedModelUrl={selectedModelUrl}
          onSelectModel={selectModel}
          onStartDownload={(url) => initModel(url)}
          onRetry={(url) => initModel(url)}
          onClearCache={clearModelCache}
        />
      )}

      {currentScreen === 'chat' && (
        <ChatInterface
          streamingText={streamingText}
          isGenerating={isGenerating}
          error={error}
          onSendPrompt={sendPrompt}
          onAbort={abortGeneration}
          onReset={resetChat}
          isDark={isDark}
          onToggleTheme={() => setIsDark(v => !v)}
          selectedModelUrl={selectedModelUrl}
          onSelectModel={selectModel}
          onClearCache={clearModelCache}
        />
      )}
    </div>
  );
}
