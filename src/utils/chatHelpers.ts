// src/utils/chatHelpers.ts

/**
 * Strip Gemma chat-template special tokens from the accumulated output.
 */
export function cleanGemmaOutput(text: string): string {
  return text
    .replace(/<start_of_turn>[^<]*<\/start_of_turn>/g, '')
    .replace(/<start_of_turn>\w*\n?/g, '')
    .replace(/<\/?(?:start|end)_of_turn>/g, '')
    .replace(/<(?:bos|eos)>/g, '')
    .replace(/^[\s\n]+/, '');
}

/**
 * Extract cache filename from modelUrl. Fallback to gemma-model.task if extension is unknown.
 */
export function getCacheFilename(modelUrl: string): string {
  if (!modelUrl) return 'gemma-model.task';
  const filename = modelUrl.split('/').pop()!.split('?')[0];
  const extension = filename?.split('.').pop()?.toLowerCase();
  const knownExtensions = ['task', 'litertlm', 'bin'];
  if (filename && extension && knownExtensions.includes(extension)) {
    return filename;
  }
  return 'gemma-model.task';
}

interface MessageLike {
  role: 'user' | 'ai';
  text: string;
}

/**
 * Slice message history based on contextDepth (where contextDepth = number of turns, 1 turn = 1 user + 1 ai message = 2 messages).
 */
export function getHistoryTurns(messages: MessageLike[], contextDepth: number): MessageLike[] {
  const sliceCount = contextDepth * 2;
  if (sliceCount <= 0 || !messages || messages.length === 0) {
    return [];
  }
  return messages.slice(-sliceCount).map(m => ({
    role: m.role,
    text: m.text
  }));
}
