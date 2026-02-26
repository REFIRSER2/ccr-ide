import React, { useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { TerminalView } from './components/TerminalView.js';
import { InputBar } from './components/InputBar.js';
import { BottomBar } from './components/BottomBar.js';
import { useConnection } from './hooks/useConnection.js';
import { useSession } from './hooks/useSession.js';
import { useTerminal } from './hooks/useTerminal.js';

export interface AppProps {
  host: string;
  port: number;
  token: string;
  sessionId?: string;
}

export function App({ host, port, token, sessionId: initialSessionId }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;
  const sidebarWidth = Math.min(20, Math.floor(terminalWidth * 0.2));

  const {
    connection,
    status,
    error,
    latency,
    connect,
  } = useConnection({ host, port, token });

  const {
    sessions,
    activeSessionId,
    createSession,
    attachSession,
    destroySession,
    refreshSessions,
  } = useSession(connection);

  const {
    outputLines,
    sendInput,
    navigateHistory,
  } = useTerminal(connection);

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // On authenticated: create or attach session
  useEffect(() => {
    if (status === 'authenticated' && connection) {
      if (initialSessionId) {
        attachSession(initialSessionId);
      } else {
        refreshSessions();
        // Auto-create if no sessions exist after a short delay
        const timer = setTimeout(() => {
          if (sessions.length === 0) {
            createSession();
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send resize when terminal dimensions change
  useEffect(() => {
    if (connection?.connected) {
      connection.sendResize(terminalWidth, terminalHeight);
    }
  }, [terminalWidth, terminalHeight, connection]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    } else if (key.ctrl && input === 'n') {
      createSession();
    } else if (key.ctrl && input === 'l') {
      refreshSessions();
    }
  });

  // Find active session name
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Calculate available height for terminal view
  // StatusBar: 2, InputBar: 2, BottomBar: 1 = 5 lines overhead
  const termViewHeight = Math.max(3, terminalHeight - 5);

  return (
    <Box flexDirection="column" height={terminalHeight} width={terminalWidth}>
      {/* Top Status Bar */}
      <StatusBar
        host={host}
        port={port}
        status={status}
        activeSessionId={activeSessionId}
        activeSessionName={activeSession?.name ?? null}
      />

      {/* Main Content Area */}
      <Box flexDirection="row" flexGrow={1} height={termViewHeight}>
        {/* Session Sidebar */}
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={attachSession}
          onCreate={() => createSession()}
          onDestroy={destroySession}
          width={sidebarWidth}
        />

        {/* Terminal Output */}
        <Box flexDirection="column" flexGrow={1}>
          {status !== 'authenticated' ? (
            <Box flexGrow={1} alignItems="center" justifyContent="center">
              <Text color="yellow">
                {status === 'connecting' ? 'Connecting...' :
                  status === 'reconnecting' ? 'Reconnecting...' :
                    status === 'connected' ? 'Authenticating...' :
                      'Disconnected'}
              </Text>
            </Box>
          ) : (
            <TerminalView
              lines={outputLines}
              height={termViewHeight}
            />
          )}
        </Box>
      </Box>

      {/* Input Bar */}
      <InputBar
        onSubmit={sendInput}
        onHistoryUp={() => navigateHistory('up')}
        onHistoryDown={() => navigateHistory('down')}
        disabled={status !== 'authenticated'}
      />

      {/* Bottom Status Bar */}
      <BottomBar
        status={status}
        latency={latency}
        sessionCount={sessions.length}
        error={error}
      />
    </Box>
  );
}
