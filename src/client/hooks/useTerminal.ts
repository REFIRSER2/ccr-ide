import { useState, useEffect, useCallback, useRef } from 'react';
import type { Connection } from '../connection.js';

const MAX_OUTPUT_LINES = 500;

export interface UseTerminalResult {
  outputLines: string[];
  inputHistory: string[];
  historyIndex: number;
  sendInput: (text: string) => void;
  sendRawKey: (data: string) => void;
  clearOutput: () => void;
  navigateHistory: (direction: 'up' | 'down') => string;
}

export function useTerminal(connection: Connection | null): UseTerminalResult {
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bufferRef = useRef('');

  useEffect(() => {
    if (!connection) return;

    const handleData = (data: Buffer) => {
      const text = data.toString('utf-8');

      // Buffer incoming data and split by newlines
      bufferRef.current += text;
      const parts = bufferRef.current.split('\n');

      if (parts.length > 1) {
        // All but the last part are complete lines
        const completeLines = parts.slice(0, -1);
        bufferRef.current = parts[parts.length - 1];

        setOutputLines(prev => {
          const updated = [...prev, ...completeLines];
          // Trim to max lines
          if (updated.length > MAX_OUTPUT_LINES) {
            return updated.slice(updated.length - MAX_OUTPUT_LINES);
          }
          return updated;
        });
      }

      // If there's a partial line in buffer, update the last line
      if (bufferRef.current.length > 0) {
        setOutputLines(prev => {
          const updated = [...prev];
          // Add or update partial line
          if (updated.length === 0 || !updated[updated.length - 1].endsWith('\r')) {
            updated.push(bufferRef.current);
          } else {
            updated[updated.length - 1] = bufferRef.current;
          }
          if (updated.length > MAX_OUTPUT_LINES) {
            return updated.slice(updated.length - MAX_OUTPUT_LINES);
          }
          return updated;
        });
      }
    };

    connection.on('data', handleData);
    return () => {
      connection.removeListener('data', handleData);
    };
  }, [connection]);

  const sendInput = useCallback((text: string) => {
    if (!connection) return;
    // Send with newline (Enter key)
    connection.sendInput(text + '\r');

    if (text.trim()) {
      setInputHistory(prev => [...prev, text]);
      setHistoryIndex(-1);
    }
  }, [connection]);

  const sendRawKey = useCallback((data: string) => {
    if (!connection) return;
    connection.sendInput(data);
  }, [connection]);

  const clearOutput = useCallback(() => {
    setOutputLines([]);
    bufferRef.current = '';
  }, []);

  const navigateHistory = useCallback((direction: 'up' | 'down'): string => {
    if (inputHistory.length === 0) return '';

    let newIndex: number;
    if (direction === 'up') {
      newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === -1 ? -1 : Math.min(inputHistory.length - 1, historyIndex + 1);
    }

    setHistoryIndex(newIndex);
    return newIndex >= 0 ? inputHistory[newIndex] : '';
  }, [inputHistory, historyIndex]);

  return {
    outputLines,
    inputHistory,
    historyIndex,
    sendInput,
    sendRawKey,
    clearOutput,
    navigateHistory,
  };
}
