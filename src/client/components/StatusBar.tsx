import React from 'react';
import { Box, Text } from 'ink';
import type { ConnectionStatus } from '../hooks/useConnection.js';

interface StatusBarProps {
  host: string;
  port: number;
  status: ConnectionStatus;
  activeSessionName: string | null;
}

export function StatusBar({ host, port, status, activeSessionName }: StatusBarProps) {
  const icon = status === 'authenticated' ? '●'
    : status === 'disconnected' ? '○'
    : '◐';
  const color = status === 'authenticated' ? 'green'
    : status === 'disconnected' ? 'red'
    : 'yellow';

  return (
    <Box height={1} paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text backgroundColor="blue" color="white" bold>{' CCR '}</Text>
        <Text color={color}>{icon}</Text>
        <Text dimColor>{host}:{port}</Text>
        {activeSessionName && (
          <>
            <Text dimColor>|</Text>
            <Text color="cyan" bold>{activeSessionName}</Text>
          </>
        )}
      </Box>
      <Box gap={1}>
        <Text dimColor>Ctrl+N</Text>
        <Text dimColor>new</Text>
        <Text dimColor>|</Text>
        <Text dimColor>Ctrl+S</Text>
        <Text dimColor>sidebar</Text>
        <Text dimColor>|</Text>
        <Text dimColor>Ctrl+C</Text>
        <Text dimColor>quit</Text>
      </Box>
    </Box>
  );
}
