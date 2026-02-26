import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionInfo } from '../../shared/types.js';

interface SessionListProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  visible: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onDestroy: (sessionId: string) => void;
  onClose: () => void;
}

export function SessionList({
  sessions,
  activeSessionId,
  visible,
  onSelect,
  onCreate,
  onDestroy,
  onClose,
}: SessionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const totalItems = sessions.length + 1; // +1 for "New Session"

  useInput((input, key) => {
    if (!visible) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(totalItems - 1, prev + 1));
    } else if (key.return) {
      if (selectedIndex < sessions.length) {
        onSelect(sessions[selectedIndex].id);
        onClose();
      } else {
        onCreate();
      }
    } else if (input === 'd') {
      if (selectedIndex < sessions.length) {
        onDestroy(sessions[selectedIndex].id);
      }
    } else if (key.escape) {
      onClose();
    }
  }, { isActive: visible });

  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      width={24}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="white"> SESSIONS </Text>
        <Text dimColor> (Esc close)</Text>
      </Box>

      {sessions.length === 0 ? (
        <Text dimColor italic>  No sessions</Text>
      ) : (
        sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const isSelected = index === selectedIndex;

          return (
            <Box key={session.id} height={1}>
              <Text
                backgroundColor={isSelected ? 'blue' : undefined}
                color={isActive ? 'green' : isSelected ? 'white' : 'gray'}
                bold={isActive || isSelected}
              >
                {isActive ? ' >' : '  '}
                {' '}{session.name.slice(0, 18)}
                {session.connected ? '' : ' (idle)'}
              </Text>
            </Box>
          );
        })
      )}

      <Box marginTop={1} height={1}>
        <Text
          backgroundColor={selectedIndex === sessions.length ? 'blue' : undefined}
          color={selectedIndex === sessions.length ? 'white' : 'green'}
          bold={selectedIndex === sessions.length}
        >
          {'  + New Session'}
        </Text>
      </Box>

      <Box marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
        <Text dimColor>
          ↑↓ select  ⏎ open  d delete
        </Text>
      </Box>
    </Box>
  );
}
