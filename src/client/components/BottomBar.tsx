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
  const statusIcon = status === 'authenticated' ? '●' : status === 'disconnected' ? '○' : '◐';
  const statusColor = status === 'authenticated' ? 'green' : status === 'disconnected' ? 'red' : 'yellow';
  const statusLabel = status === 'authenticated' ? 'Online' : status;

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color={statusColor} bold>
          {statusIcon} {statusLabel}
        </Text>
        {latency > 0 && (
          <Text dimColor>
            {latency}ms
          </Text>
        )}
        <Text dimColor>
          {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </Text>
      </Box>

      <Box gap={2}>
        {error && (
          <Text color="red">
            {truncateError(error)}
          </Text>
        )}
        <Text dimColor>
          Tab:focus  Ctrl+N:new  Ctrl+C:quit
        </Text>
      </Box>
    </Box>
  );
}

function truncateError(err: string): string {
  if (err.length > 40) return err.slice(0, 37) + '...';
  return err;
}
