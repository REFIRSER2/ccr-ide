import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import type { Connection } from '../connection.js';

const MAX_MESSAGES = 200;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface UseTerminalResult {
  messages: ChatMessage[];
  inputHistory: string[];
  sendInput: (text: string) => void;
  sendRawKey: (data: string) => void;
  clearMessages: () => void;
  navigateHistory: (direction: 'up' | 'down') => string;
}

let messageIdCounter = 0;
function nextId(): string {
  return String(++messageIdCounter);
}

export function useTerminal(connectionRef: RefObject<Connection | null>): UseTerminalResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const historyIndexRef = useRef(-1);
  const outputBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush buffered output as a single assistant message
  const flushBuffer = useCallback(() => {
    if (outputBufferRef.current.length === 0) return;

    const content = cleanAnsi(outputBufferRef.current);
    outputBufferRef.current = '';

    if (content.trim().length === 0) return;

    setMessages(prev => {
      // Merge into last assistant message if it exists and is recent
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' &&
          Date.now() - last.timestamp.getTime() < 2000) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          content: last.content + content,
        };
        if (updated.length > MAX_MESSAGES) {
          return updated.slice(updated.length - MAX_MESSAGES);
        }
        return updated;
      }

      const newMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content,
        timestamp: new Date(),
      };
      const updated = [...prev, newMsg];
      if (updated.length > MAX_MESSAGES) {
        return updated.slice(updated.length - MAX_MESSAGES);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn) return;

    const handleData = (data: Buffer) => {
      outputBufferRef.current += data.toString('utf-8');

      // Debounce flush: wait for data to stop streaming before creating message
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(flushBuffer, 100);
    };

    conn.on('data', handleData);
    return () => {
      conn.removeListener('data', handleData);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [connectionRef.current, flushBuffer]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendInput = useCallback((text: string) => {
    const conn = connectionRef.current;
    if (!conn) return;

    // Flush any pending output first
    flushBuffer();

    // Add user message to chat
    setMessages(prev => {
      const newMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      return [...prev, newMsg];
    });

    // Send to PTY with carriage return
    conn.sendInput(text + '\r');

    if (text.trim()) {
      setInputHistory(prev => [...prev, text]);
      historyIndexRef.current = -1;
    }
  }, [connectionRef, flushBuffer]);

  const sendRawKey = useCallback((data: string) => {
    connectionRef.current?.sendInput(data);
  }, [connectionRef]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    outputBufferRef.current = '';
  }, []);

  const navigateHistory = useCallback((direction: 'up' | 'down'): string => {
    if (inputHistory.length === 0) return '';

    if (direction === 'up') {
      historyIndexRef.current = historyIndexRef.current === -1
        ? inputHistory.length - 1
        : Math.max(0, historyIndexRef.current - 1);
    } else {
      historyIndexRef.current = historyIndexRef.current === -1
        ? -1
        : Math.min(inputHistory.length, historyIndexRef.current + 1);
      if (historyIndexRef.current >= inputHistory.length) {
        historyIndexRef.current = -1;
      }
    }

    return historyIndexRef.current >= 0
      ? inputHistory[historyIndexRef.current]
      : '';
  }, [inputHistory]);

  return {
    messages,
    inputHistory,
    sendInput,
    sendRawKey,
    clearMessages,
    navigateHistory,
  };
}

/**
 * Clean ANSI escape codes for display in Ink.
 * Strips cursor movement, screen clearing, and non-SGR sequences.
 * Keeps basic color (SGR) sequences that Ink can handle.
 */
function cleanAnsi(str: string): string {
  return str
    // Remove OSC sequences (title bar, etc)
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    // Remove cursor movement/position: ESC[nA, ESC[nB, ESC[nC, ESC[nD, ESC[H, ESC[f
    .replace(/\x1b\[\d*[ABCDHfG]/g, '')
    // Remove erase: ESC[nJ, ESC[nK
    .replace(/\x1b\[\d*[JK]/g, '')
    // Remove mode set/reset: ESC[?n[hl]
    .replace(/\x1b\[\?\d+[hl]/g, '')
    // Remove scroll region, save/restore cursor
    .replace(/\x1b\[\d*;?\d*[rs]/g, '')
    .replace(/\x1b[78]/g, '')
    // Remove other non-SGR CSI sequences (keep m for colors)
    .replace(/\x1b\[[\d;]*[a-lnp-zA-Z]/g, '')
    // Remove lone ESC sequences
    .replace(/\x1b[^[\]m]/g, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n');
}
