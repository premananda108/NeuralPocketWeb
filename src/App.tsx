import { useState, useEffect } from 'react';
import OnboardingScreen from './components/OnboardingScreen';
import ModelDownloader from './components/ModelDownloader';
import ChatInterface from './components/ChatInterface';
import { useGemmaModel } from './hooks/useGemmaModel';

type AppState = 'onboarding' | 'loading' | 'chat';

export default function App() {
  const [appState, setAppState] = useState<AppState>('onboarding');
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

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

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (hasSeenOnboarding && appState === 'onboarding') {
      setAppState('loading');
    }
  }, [appState]);

  const handleStart = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setAppState('loading');
  };

  useEffect(() => {
    if (status === 'ready' && appState === 'loading') {
      setAppState('chat');
    } else if (status !== 'ready' && appState === 'chat') {
      setAppState('loading');
    }
  }, [status, appState]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {appState === 'onboarding' && (
        <OnboardingScreen onContinue={handleStart} />
      )}

      {appState === 'loading' && (
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

      {appState === 'chat' && (
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
