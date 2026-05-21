import { useState, useEffect } from 'react';
import OnboardingScreen from './components/OnboardingScreen';
import ModelDownloader from './components/ModelDownloader';
import ChatInterface from './components/ChatInterface';
import { useGemmaModel } from './hooks/useGemmaModel';

export default function App() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(
    () => localStorage.getItem('hasSeenOnboarding') === 'true'
  );
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

  const handleStart = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setHasSeenOnboarding(true);
  };

  const currentScreen = !hasSeenOnboarding
    ? 'onboarding'
    : status === 'ready'
      ? 'chat'
      : 'loading';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
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
