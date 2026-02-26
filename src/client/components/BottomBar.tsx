import React from 'react';
import { Box, Text } from 'ink';
import type { ConnectionStatus } from '../hooks/useConnection.js';

interface BottomBarProps {
  status: ConnectionStatus;
  latency: number;
  sessionCount: number;
  error: string | null;
}

export function BottomBar({ status, latency, sessionCount, error }: BottomBarProps) {
  const icon = status === 'authenticated' ? '●'
    : status === 'disconnected' ? '○'
    : '◐';
  const color = status === 'authenticated' ? 'green'
    : status === 'disconnected' ? 'red'
    : 'yellow';
  const label = status === 'authenticated' ? 'Online'
    : status === 'disconnected' ? 'Offline'
    : status;

  return (
    <Box height={1} paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color={color}>
          {icon} {label}
        </Text>
        {latency > 0 && (
          <Text dimColor>{latency}ms</Text>
        )}
        <Text dimColor>
          {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </Text>
      </Box>
      <Box gap={1}>
        {error ? (
          <Text color="red">{error.length > 50 ? error.slice(0, 47) + '...' : error}</Text>
        ) : (
          <Text dimColor>/help for commands</Text>
        )}
      </Box>
    </Box>
  );
}
