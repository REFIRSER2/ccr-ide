import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { SessionList } from './components/SessionList.js';
import { ChatView } from './components/ChatView.js';
import { InputBar } from './components/InputBar.js';
import { BottomBar } from './components/BottomBar.js';
import { useConnection } from './hooks/useConnection.js';
import { useSession } from './hooks/useSession.js';
import { useTerminal, type ChatMessage } from './hooks/useTerminal.js';
import { handleCommand, type CommandContext } from './commands.js';

export interface AppProps {
  host: string;
  port: number;
  token: string;
  sessionId?: string;
}

export function App({ host, port, token, sessionId: initialSessionId }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const termHeight = stdout?.rows ?? 24;
  const termWidth = stdout?.columns ?? 80;

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(true);

  const {
    connectionRef,
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
  } = useSession(connectionRef);

  const {
    messages,
    sendInput,
    sendRawKey,
    clearMessages,
    navigateHistory,
  } = useTerminal(connectionRef);

  // System messages managed via state
  const [systemMessages, setSystemMessages] = useState<ChatMessage[]>([]);

  const addSysMsg = useCallback((content: string) => {
    setSystemMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      role: 'system' as const,
      content,
      timestamp: new Date(),
    }]);
  }, []);

  // Combine terminal messages with system messages
  const allMessages = [...messages, ...systemMessages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Command context
  const commandCtx: CommandContext = {
    addSystemMessage: addSysMsg,
    clearMessages: () => {
      clearMessages();
      setSystemMessages([]);
    },
    sendRawKey,
    createSession,
    refreshSessions,
    toggleSidebar: () => setSidebarVisible(v => !v),
    exitApp: exit,
    switchToRaw: () => {
      addSysMsg('Raw mode not supported from TUI. Restart with --raw flag.');
    },
  };

  // Handle /commands from input
  const onCommand = useCallback((cmd: string, args: string): boolean => {
    return handleCommand(cmd, args, commandCtx);
  }, [commandCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // On authenticated: create or attach session
  useEffect(() => {
    if (status === 'authenticated') {
      const conn = connectionRef.current;
      if (!conn) return;

      if (initialSessionId) {
        attachSession(initialSessionId);
      } else {
        refreshSessions();
        const timer = setTimeout(() => {
          if (sessions.length === 0) {
            createSession();
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send resize
  useEffect(() => {
    connectionRef.current?.sendResize(termWidth, termHeight);
  }, [termWidth, termHeight, connectionRef]);

  // Global shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    } else if (key.ctrl && input === 'n') {
      createSession();
    } else if (key.ctrl && input === 's') {
      setSidebarVisible(v => !v);
    } else if (key.tab) {
      if (sidebarVisible) {
        setSidebarVisible(false);
        setInputFocused(true);
      } else {
        setInputFocused(v => !v);
      }
    }
  });

  // Active session name
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Layout: StatusBar(1) + Chat(flex) + Input(1) + BottomBar(1) = 3 overhead
  const chatHeight = Math.max(3, termHeight - 3);

  return (
    <Box flexDirection="column" height={termHeight} width={termWidth}>
      {/* Title Bar */}
      <StatusBar
        host={host}
        port={port}
        status={status}
        activeSessionName={activeSession?.name ?? null}
      />

      {/* Main Content */}
      <Box flexDirection="row" flexGrow={1} height={chatHeight}>
        {/* Session Sidebar (overlay) */}
        {sidebarVisible && (
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            visible={sidebarVisible}
            onSelect={attachSession}
            onCreate={() => createSession()}
            onDestroy={destroySession}
            onClose={() => {
              setSidebarVisible(false);
              setInputFocused(true);
            }}
          />
        )}

        {/* Chat Area */}
        <Box flexDirection="column" flexGrow={1}>
          {status !== 'authenticated' ? (
            <Box flexGrow={1} alignItems="center" justifyContent="center">
              <Box flexDirection="column" alignItems="center" gap={1}>
                <Text color="cyan" bold>Claude Code Remote CLI</Text>
                <Text color="yellow">
                  {status === 'connecting' ? '  Connecting...' :
                    status === 'reconnecting' ? '  Reconnecting...' :
                      status === 'connected' ? '  Authenticating...' :
                        '  Disconnected'}
                </Text>
                {error && <Text color="red">{error}</Text>}
              </Box>
            </Box>
          ) : (
            <ChatView
              messages={allMessages}
              height={chatHeight - 1}
              isInputFocused={inputFocused}
            />
          )}

          {/* Input Bar */}
          <InputBar
            onSubmit={sendInput}
            onHistoryUp={() => navigateHistory('up')}
            onHistoryDown={() => navigateHistory('down')}
            onCommand={onCommand}
            disabled={status !== 'authenticated'}
            isFocused={inputFocused && !sidebarVisible}
          />
        </Box>
      </Box>

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
