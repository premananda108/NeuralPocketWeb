import { useEffect, useState } from 'react';

interface OnboardingScreenProps {
  onContinue: () => void;
}

const features = [
  { icon: '📷🎙️', title: 'Vision & Audio', description: 'Send photos or audio recordings — analyze images, transcribe/understand speech instantly' },
  { icon: '🤖', title: 'On-Device AI',  description: 'Powered by Gemma 4 — runs entirely in your browser, no cloud needed' },
  { icon: '🔒', title: '100% Private',  description: 'Nothing leaves your device. Works fully offline and in airplane mode.' },
  { icon: '💬', title: 'Any Topic',  description: 'Ask anything: translate, explain, summarize, brainstorm, solve problems' },
];

export default function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'relative', minHeight: '100dvh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 20px', background: 'var(--bg)', overflow: 'hidden',
    }}>

      {/* bg decoration */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(42,171,238,0.06)', filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-10%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'rgba(42,171,238,0.04)', filter: 'blur(80px)',
        }} />
      </div>

      {/* content */}
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: 'opacity 0.7s, transform 0.7s',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
      }}>
        {/* Logo */}
        <div className="float" style={{ marginBottom: 28 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 28,
            background: 'linear-gradient(135deg, #2AABEE, #1A8CC8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 42, boxShadow: '0 12px 40px rgba(42,171,238,0.35)',
          }}>
            🧠
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          textAlign: 'center', marginBottom: 12, lineHeight: 1.2,
          fontWeight: 800, fontSize: 'clamp(28px, 6vw, 40px)',
          color: 'var(--text-primary)',
        }}>
          <span className="gradient-text">NeuralPocket</span>
        </h1>

        <p style={{
          color: 'var(--text-secondary)', textAlign: 'center',
          fontSize: 16, marginBottom: 36, lineHeight: 1.6, maxWidth: 390,
        }}>
          Your personal AI assistant — analyze images, transcribe audio, and chat with complete on-device privacy. No internet required.
        </p>

        {/* Feature cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, width: '100%', marginBottom: 36,
        }}>
          {features.map((f, i) => (
            <div
              key={f.title}
              className="tg-card"
              style={{
                padding: '14px 16px', borderRadius: 14, cursor: 'default',
                transition: `opacity 0.6s ${300 + i * 120}ms, transform 0.6s ${300 + i * 120}ms`,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {f.description}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          id="onboarding-continue-btn"
          onClick={onContinue}
          className="tg-btn-primary"
          style={{
            width: '100%', maxWidth: 340, padding: '14px 24px',
            fontSize: 16, borderRadius: 14,
            transition: `opacity 0.6s 900ms, transform 0.6s 900ms, background 0.2s, box-shadow 0.2s`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
          }}
        >
          Get Started →
        </button>

        {/* badge */}
        <div style={{
          marginTop: 20, display: 'flex', alignItems: 'center', gap: 7,
          color: 'var(--text-secondary)', fontSize: 12,
          transition: `opacity 0.6s 1100ms`,
          opacity: isVisible ? 0.7 : 0,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#4CAF50',
            boxShadow: '0 0 6px rgba(76,175,80,0.6)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          Powered by Gemma 4 · Edge AI · No server required
        </div>
      </div>
    </div>
  );
}
