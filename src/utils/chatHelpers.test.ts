// src/utils/chatHelpers.test.ts
import { describe, it, expect } from 'vitest';
import { cleanGemmaOutput, getCacheFilename, getHistoryTurns } from './chatHelpers';

describe('cleanGemmaOutput', () => {
  it('should clean simple gemma start/end turn control tags', () => {
    const input = '<start_of_turn>model\nHello! How can I help you today?<end_of_turn>';
    const expected = 'Hello! How can I help you today?';
    expect(cleanGemmaOutput(input)).toBe(expected);
  });

  it('should clean bos and eos tags', () => {
    const input = '<bos>Greetings!<eos>';
    const expected = 'Greetings!';
    expect(cleanGemmaOutput(input)).toBe(expected);
  });

  it('should preserve regular user text and format output correctly', () => {
    const input = 'This is a normal response without special tags.';
    expect(cleanGemmaOutput(input)).toBe('This is a normal response without special tags.');
  });

  it('should handle complex nested or multiline tags cleanly', () => {
    const input = '<start_of_turn>user\nHi!<end_of_turn>\n<start_of_turn>model\nHello there!';
    const expected = 'Hello there!';
    expect(cleanGemmaOutput(input)).toBe(expected);
  });
});

describe('getCacheFilename', () => {
  it('should extract correct filename for valid .task models', () => {
    const url = 'https://example.com/models/gemma-4-e2b.task';
    expect(getCacheFilename(url)).toBe('gemma-4-e2b.task');
  });

  it('should extract correct filename for valid .litertlm models', () => {
    const url = 'http://localhost:5173/gemma-3n-E2B-it-int4-Web.litertlm';
    expect(getCacheFilename(url)).toBe('gemma-3n-E2B-it-int4-Web.litertlm');
  });

  it('should strip query parameters correctly', () => {
    const url = 'https://cdn.example.com/gemma-4-e4b.task?v=2.0&auth=token';
    expect(getCacheFilename(url)).toBe('gemma-4-e4b.task');
  });

  it('should fallback to default if extension is not recognized', () => {
    const url = 'https://example.com/models/index.html';
    expect(getCacheFilename(url)).toBe('gemma-model.task');
  });

  it('should fallback to default if URL is empty or malformed', () => {
    expect(getCacheFilename('')).toBe('gemma-model.task');
  });
});

describe('getHistoryTurns', () => {
  const dummyMessages = [
    { role: 'user' as const, text: 'Hello' },
    { role: 'ai' as const, text: 'Hi! How can I help?' },
    { role: 'user' as const, text: 'What is WebGPU?' },
    { role: 'ai' as const, text: 'WebGPU is a modern graphics API.' },
    { role: 'user' as const, text: 'Is it fast?' },
  ];

  it('should return empty array if contextDepth is 0', () => {
    expect(getHistoryTurns(dummyMessages, 0)).toEqual([]);
  });

  it('should slice the last 2 messages (1 turn) if contextDepth is 1', () => {
    const result = getHistoryTurns(dummyMessages, 1);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'ai', text: 'WebGPU is a modern graphics API.' });
    expect(result[1]).toEqual({ role: 'user', text: 'Is it fast?' });
  });

  it('should slice the last 4 messages (2 turns) if contextDepth is 2', () => {
    const result = getHistoryTurns(dummyMessages, 2);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: 'ai', text: 'Hi! How can I help?' });
    expect(result[3]).toEqual({ role: 'user', text: 'Is it fast?' });
  });

  it('should return all messages (up to length) if contextDepth is larger than available turns', () => {
    const result = getHistoryTurns(dummyMessages, 10);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ role: 'user', text: 'Hello' });
  });

  it('should handle empty input array safely', () => {
    expect(getHistoryTurns([], 3)).toEqual([]);
  });
});
