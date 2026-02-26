import React from 'react';
import { Box, Text } from 'ink';
import type { ConnectionStatus } from '../hooks/useConnection.js';
import { APP_VERSION } from '../../shared/constants.js';

interface StatusBarProps {
  host: string;
  port: number;
  status: ConnectionStatus;
  activeSessionId: string | null;
  activeSessionName: string | null;
}

export function StatusBar({ host, port, status, activeSessionId, activeSessionName }: StatusBarProps) {
  const statusIcon = getStatusIcon(status);
  const statusColor = getStatusColor(status);

  return (
    <Box
      borderStyle="single"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={2}>
        <Text color={statusColor} bold>{statusIcon} CCR</Text>
        <Text dimColor>
          {host}:{port}
        </Text>
        {activeSessionId && (
          <Text color="cyan">
            Session: {activeSessionName ?? activeSessionId}
          </Text>
        )}
      </Box>
      <Box gap={2}>
        <Text dimColor>v{APP_VERSION}</Text>
        <Text color={statusColor}>{status}</Text>
      </Box>
    </Box>
  );
}

function getStatusIcon(status: ConnectionStatus): string {
  switch (status) {
    case 'authenticated': return '●';
    case 'connected': return '◐';
    case 'connecting': return '○';
    case 'reconnecting': return '◌';
    case 'disconnected': return '○';
  }
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'authenticated': return 'green';
    case 'connected': return 'yellow';
    case 'connecting': return 'yellow';
    case 'reconnecting': return 'yellow';
    case 'disconnected': return 'red';
  }
}
