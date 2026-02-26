import React, { useState } from 'react';
import { Box, Text, useFocus, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBarProps {
  onSubmit: (text: string) => void;
  onRawKey?: (key: string) => void;
  onHistoryUp?: () => string;
  onHistoryDown?: () => string;
  disabled?: boolean;
}

export function InputBar({ onSubmit, onHistoryUp, onHistoryDown, disabled }: InputBarProps) {
  const { isFocused } = useFocus({ id: 'input-bar', autoFocus: true });
  const [value, setValue] = useState('');

  useInput((_input, key) => {
    if (!isFocused) return;

    if (key.upArrow && onHistoryUp) {
      const prev = onHistoryUp();
      if (prev !== undefined) setValue(prev);
    } else if (key.downArrow && onHistoryDown) {
      const next = onHistoryDown();
      if (next !== undefined) setValue(next);
    }
  }, { isActive: isFocused });

  const handleSubmit = (text: string) => {
    if (disabled) return;
    onSubmit(text);
    setValue('');
  };

  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
    >
      <Text color={isFocused ? 'cyan' : 'gray'} bold>
        {'> '}
      </Text>
      {isFocused ? (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={disabled ? 'Connecting...' : 'Type a message...'}
        />
      ) : (
        <Text dimColor>{value || 'Press Tab to focus input'}</Text>
      )}
    </Box>
  );
}
