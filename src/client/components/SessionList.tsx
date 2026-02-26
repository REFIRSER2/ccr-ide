import React from 'react';
import { Box, Text, useFocus, useInput } from 'ink';
import type { SessionInfo } from '../../shared/types.js';

interface SessionListProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDestroy: (sessionId: string) => void;
  width: number;
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDestroy,
  width,
}: SessionListProps) {
  const { isFocused } = useFocus({ id: 'session-list' });
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Include a "New Session" entry at the end
  const totalItems = sessions.length + 1;

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(totalItems - 1, prev + 1));
    } else if (key.return) {
      if (selectedIndex < sessions.length) {
        onSelect(sessions[selectedIndex].id);
      } else {
        onCreate();
      }
    } else if (input === 'd' || key.delete) {
      if (selectedIndex < sessions.length) {
        onDestroy(sessions[selectedIndex].id);
      }
    }
  }, { isActive: isFocused });

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderRight={true}
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
    >
      <Box paddingX={1}>
        <Text bold underline color={isFocused ? 'cyan' : 'white'}>
          Sessions
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const isSelected = index === selectedIndex && isFocused;

          return (
            <Box key={session.id}>
              <Text
                color={isActive ? 'green' : isSelected ? 'cyan' : 'white'}
                bold={isActive}
                inverse={isSelected}
              >
                {isActive ? ' > ' : '   '}
                {truncate(session.name, width - 6)}
              </Text>
            </Box>
          );
        })}

        {/* New Session button */}
        <Box marginTop={sessions.length > 0 ? 1 : 0}>
          <Text
            color="green"
            inverse={selectedIndex === sessions.length && isFocused}
          >
            {'   '}[+] New
          </Text>
        </Box>
      </Box>

      {isFocused && (
        <Box paddingX={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false}>
          <Text dimColor>
            ↑↓ nav  ⏎ select  d del
          </Text>
        </Box>
      )}
    </Box>
  );
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
