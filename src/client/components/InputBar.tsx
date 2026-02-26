import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputBarProps {
  onSubmit: (text: string) => void;
  onHistoryUp: () => string;
  onHistoryDown: () => string;
  onCommand?: (command: string, args: string) => boolean;
  disabled?: boolean;
  isFocused: boolean;
}

export function InputBar({ onSubmit, onHistoryUp, onHistoryDown, onCommand, disabled, isFocused }: InputBarProps) {
  const [value, setValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  const handleSubmit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;

    // Check for /commands
    if (text.startsWith('/') && onCommand) {
      const spaceIdx = text.indexOf(' ');
      const cmd = spaceIdx > 0 ? text.slice(1, spaceIdx) : text.slice(1);
      const args = spaceIdx > 0 ? text.slice(spaceIdx + 1) : '';
      const handled = onCommand(cmd, args);
      if (handled) {
        setValue('');
        setCursorPos(0);
        return;
      }
    }

    onSubmit(text);
    setValue('');
    setCursorPos(0);
  }, [value, disabled, onSubmit, onCommand]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.return) {
      handleSubmit();
    } else if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const newVal = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        setValue(newVal);
        setCursorPos(prev => prev - 1);
      }
    } else if (key.leftArrow) {
      setCursorPos(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      setCursorPos(prev => Math.min(value.length, prev + 1));
    } else if (key.upArrow) {
      const prev = onHistoryUp();
      if (prev !== undefined && prev !== null) {
        setValue(prev);
        setCursorPos(prev.length);
      }
    } else if (key.downArrow) {
      const next = onHistoryDown();
      setValue(next ?? '');
      setCursorPos((next ?? '').length);
    } else if (key.ctrl && input === 'u') {
      // Clear line
      setValue('');
      setCursorPos(0);
    } else if (key.ctrl && input === 'a') {
      // Move to start
      setCursorPos(0);
    } else if (key.ctrl && input === 'e') {
      // Move to end
      setCursorPos(value.length);
    } else if (input && !key.ctrl && !key.meta) {
      // Regular character input (handles Korean and other Unicode)
      const newVal = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      setValue(newVal);
      setCursorPos(prev => prev + input.length);
    }
  }, { isActive: isFocused });

  // Render input with cursor indicator
  const beforeCursor = value.slice(0, cursorPos);
  const atCursor = value[cursorPos] ?? ' ';
  const afterCursor = value.slice(cursorPos + 1);

  return (
    <Box paddingX={1} height={1}>
      <Text color={isFocused ? 'cyan' : 'gray'} bold>
        {disabled ? '  ... ' : '  >  '}
      </Text>
      {isFocused ? (
        <Text>
          {beforeCursor}
          <Text inverse>{atCursor}</Text>
          {afterCursor}
        </Text>
      ) : (
        <Text dimColor>
          {value || (disabled ? 'Connecting...' : 'Press Tab to focus')}
        </Text>
      )}
    </Box>
  );
}
