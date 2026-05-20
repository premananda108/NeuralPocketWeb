import { useEffect, useState } from 'react';
import type { ModelStatus, ModelProgress } from '../hooks/useGemmaModel';
import { MODELS_LIST } from '../hooks/useGemmaModel';

interface ModelDownloaderProps {
  status: ModelStatus;
  progress: ModelProgress;
  error: string | null;
  selectedModelUrl: string;
  onSelectModel: (url: string) => void;
  onStartDownload: (modelUrl: string) => void;
  onRetry: (modelUrl: string) => void;
  onClearCache: () => void;
}

export default function ModelDownloader({
  status, progress, error,
  selectedModelUrl, onSelectModel,
  onStartDownload, onRetry, onClearCache,
}: ModelDownloaderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    if (showUrlInput && customUrl.trim()) {
      onStartDownload(customUrl.trim());
    } else {
      onStartDownload(selectedModelUrl);
    }
  };

  const isWebGPUError = (error?.toLowerCase().includes('webgpu') ||
    error?.toLowerCase().includes('adapter') ||
    error?.toLowerCase().includes('navigator.gpu') ||
    error?.toLowerCase().includes('shader-f16') ||
    error?.toLowerCase().includes('modulefactory')) ?? false;

  const isShaderF16Error = (error?.toLowerCase().includes('shader-f16') ||
    error?.toLowerCase().includes('modulefactory')) ?? false;

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 20px', position: 'relative', overflow: 'hidden',
    }}>

      {/* bg glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '15%', left: '20%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(42,171,238,0.05)', filter: 'blur(80px)',
        }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
        transition: 'opacity 0.5s, transform 0.5s',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
      }}>

        {/* ── Logo ── */}
        <img
          src="/apple-touch-icon.png"
          alt="NeuralPocket Logo"
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            boxShadow: '0 8px 30px rgba(42,171,238,0.2)',
            objectFit: 'cover',
          }}
        />

        {/* ── Model Selection (Idle state) ── */}
        {(status === 'idle') && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                Choose Your AI Model
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Select a model to run on-device. Larger models are smarter but need more GPU memory.
              </p>
            </div>

            {/* Model cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MODELS_LIST.map((m) => {
                const isSelected = selectedModelUrl === m.url && !showUrlInput;
                return (
                  <div
                    key={m.id}
                    onClick={() => { setShowUrlInput(false); onSelectModel(m.url); }}
                    className="tg-card"
                    style={{
                      padding: '16px 20px', cursor: 'pointer',
                      border: isSelected ? '2px solid #2AABEE' : '1px solid var(--divider)',
                      background: isSelected ? 'rgba(42,171,238,0.06)' : 'var(--surface)',
                      borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: isSelected ? '5px solid #2AABEE' : '2px solid var(--text-secondary)',
                      background: isSelected ? '#fff' : 'transparent',
                      transition: 'border 0.2s, background 0.2s',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {m.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {m.description}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Custom URL Card */}
              <div
                className="tg-card"
                style={{
                  padding: '16px 20px', cursor: 'pointer',
                  border: showUrlInput ? '2px solid #2AABEE' : '1px solid var(--divider)',
                  background: showUrlInput ? 'rgba(42,171,238,0.06)' : 'var(--surface)',
                  borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <div
                  onClick={() => setShowUrlInput(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: showUrlInput ? '5px solid #2AABEE' : '2px solid var(--text-secondary)',
                    background: showUrlInput ? '#fff' : 'transparent',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      Custom Model URL
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Load any compatible MediaPipe GenAI .task model
                    </div>
                  </div>
                </div>

                {showUrlInput && (
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="input-field"
                    placeholder="https://example.com/model.task"
                    style={{ fontSize: 13, padding: '8px 12px', marginTop: 4, width: '100%' }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={showUrlInput && !customUrl.trim()}
              className="tg-btn-primary"
              style={{
                width: '100%', padding: '14px 28px', fontSize: 16,
                fontWeight: 700, borderRadius: 12, marginTop: 8,
              }}
            >
              Launch NeuralPocket →
            </button>
          </div>
        )}

        {/* ── Checking Cache state ── */}
        {(status === 'checking-cache') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '3px solid var(--divider)',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '3px solid transparent', borderTopColor: '#2AABEE',
                animation: 'spin 0.9s linear infinite',
              }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Checking browser cache…</p>
          </div>
        )}

        {/* ── Downloading ── */}
        {status === 'downloading' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>
                Downloading AI Model
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                One-time download — future visits load instantly from cache.
              </div>
            </div>

            {/* progress bar */}
            <div className="tg-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {progress.downloadedMB.toFixed(1)} MB
                  {progress.totalMB > 0 && (
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                      {' '}/ {progress.totalMB.toFixed(1)} MB
                    </span>
                  )}
                </span>
                <span style={{ color: '#2AABEE', fontWeight: 700 }}>
                  {progress.percent > 0 ? `${progress.percent.toFixed(0)}%` : '…'}
                </span>
              </div>
              <div style={{
                width: '100%', height: 8, borderRadius: 8,
                background: 'var(--input-field-bg)', overflow: 'hidden',
              }}>
                <div
                  className="progress-fill"
                  style={{
                    height: '100%', borderRadius: 8,
                    width: `${Math.max(progress.percent, 2)}%`,
                    transition: 'width 0.3s ease-out',
                  }}
                />
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>
              ☕ Grab a coffee — the AI brain is quite large
            </p>
          </div>
        )}

        {/* ── Initializing ── */}
        {status === 'initializing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Warming Up NeuralPocket
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {progress.stage}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="typing-dot"
                  style={{ width: 10, height: 10, animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              {isWebGPUError ? '🎮' : '⚠️'}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#FF5252', marginBottom: 8 }}>
                {isWebGPUError ? 'WebGPU Required' : 'Something went wrong'}
              </div>

              {isWebGPUError ? (
                isShaderF16Error ? (
                  <div className="tg-card" style={{ padding: '14px 16px', textAlign: 'left', maxWidth: 420 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      WebGPU is supported, but the required <strong style={{ color: '#FF5252' }}>shader-f16</strong> (16-bit float) capability is missing or disabled in your browser.
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
                      How to fix on Windows (especially AMD / NVIDIA dual-GPU systems):
                    </div>
                    <ol style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.8, marginBottom: 10 }}>
                      <li>
                        <strong>Force Discrete GPU:</strong> Open <em>Windows Settings → System → Display → Graphics</em>. Find or add <strong>Google Chrome</strong> (usually at <code>C:\Program Files\Google\Chrome\Application\chrome.exe</code>), click <em>Options</em>, select <strong>High performance</strong>, and click <em>Save</em>.
                      </li>
                      <li>
                        <strong>Update Drivers:</strong> Ensure your AMD or NVIDIA graphics drivers are updated to the latest version.
                      </li>
                      <li>
                        <strong>Enable Browser Flags:</strong> Open <code>chrome://flags</code>. Search and <strong>Enable</strong>:
                        <ul style={{ paddingLeft: '1rem', marginTop: 4, listStyleType: 'disc' }}>
                          <li><code>Unsafe WebGPU Support</code></li>
                          <li><code>WebGPU Developer Features</code></li>
                        </ul>
                      </li>
                    </ol>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, borderTop: '1px solid var(--divider)', paddingTop: 8 }}>
                      <strong>Tip:</strong> Restart Chrome completely after applying changes!
                    </p>
                  </div>
                ) : (
                  <div className="tg-card" style={{ padding: '14px 16px', textAlign: 'left' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      This model requires <strong style={{ color: '#2AABEE' }}>WebGPU</strong> — GPU acceleration in the browser.
                    </p>
                    <ol style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.8 }}>
                      <li>Open <code style={{ color: '#2AABEE', background: 'rgba(42,171,238,0.1)', padding: '1px 4px', borderRadius: 3 }}>chrome://settings/system</code></li>
                      <li>Enable <strong style={{ color: 'var(--text-primary)' }}>"Use hardware acceleration"</strong></li>
                      <li>Open <code style={{ color: '#2AABEE', background: 'rgba(42,171,238,0.1)', padding: '1px 4px', borderRadius: 3 }}>chrome://flags/#enable-webgpu-developer-features</code></li>
                      <li>Set to <strong style={{ color: 'var(--text-primary)' }}>Enabled</strong> → Relaunch</li>
                    </ol>
                  </div>
                )
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-word', maxWidth: 340 }}>
                  {error}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
              <button
                onClick={() => onSelectModel(selectedModelUrl)}
                className="tg-btn-secondary"
                style={{ flex: 1, maxWidth: 160 }}
              >
                Change Model
              </button>
              <button
                id="model-retry-btn"
                onClick={() => onRetry(selectedModelUrl)}
                className="tg-btn-primary"
                style={{ flex: 1, maxWidth: 160 }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* clear cache hint */}
        {status !== 'error' && status !== 'idle' && (
          <button
            onClick={() => onClearCache()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-secondary)', opacity: 0.5,
              fontFamily: 'inherit', textDecoration: 'underline',
            }}
          >
            Clear cached model
          </button>
        )}
      </div>
    </div>
  );
}
