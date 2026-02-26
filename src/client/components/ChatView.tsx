import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ChatMessage } from '../hooks/useTerminal.js';

interface ChatViewProps {
  messages: ChatMessage[];
  height: number;
  isInputFocused: boolean;
}

export function ChatView({ messages, height, isInputFocused }: ChatViewProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Render messages to lines
  const renderedLines = renderMessages(messages);
  const viewHeight = Math.max(1, height);
  const maxOffset = Math.max(0, renderedLines.length - viewHeight);

  // Auto-scroll on new content
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxOffset);
    }
  }, [renderedLines.length, maxOffset, autoScroll]);

  useInput((_input, key) => {
    if (isInputFocused) return;

    if (key.upArrow) {
      setAutoScroll(false);
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const next = Math.min(maxOffset, scrollOffset + 1);
      setScrollOffset(next);
      if (next >= maxOffset) setAutoScroll(true);
    } else if (key.pageUp) {
      setAutoScroll(false);
      setScrollOffset(prev => Math.max(0, prev - viewHeight));
    } else if (key.pageDown) {
      const next = Math.min(maxOffset, scrollOffset + viewHeight);
      setScrollOffset(next);
      if (next >= maxOffset) setAutoScroll(true);
    }
  });

  const visibleLines = renderedLines.slice(scrollOffset, scrollOffset + viewHeight);

  // Scrollbar position
  const showScrollbar = renderedLines.length > viewHeight;
  const scrollbarPos = maxOffset > 0
    ? Math.round((scrollOffset / maxOffset) * (viewHeight - 1))
    : 0;

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleLines.length === 0 ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <Text dimColor italic>
              No messages yet. Type below to start chatting with Claude Code.
            </Text>
          </Box>
        ) : (
          visibleLines.map((line, i) => (
            <Text key={scrollOffset + i} wrap="truncate">
              {line.text}
            </Text>
          ))
        )}
        {/* Fill remaining space */}
        {visibleLines.length > 0 && visibleLines.length < viewHeight &&
          Array.from({ length: viewHeight - visibleLines.length }).map((_, i) => (
            <Text key={`pad-${i}`}> </Text>
          ))
        }
      </Box>

      {/* Scrollbar */}
      {showScrollbar && (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: viewHeight }).map((_, i) => (
            <Text key={`sb-${i}`} color={i === scrollbarPos ? 'cyan' : 'gray'}>
              {i === scrollbarPos ? '█' : '░'}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

interface RenderedLine {
  text: string;
}

function renderMessages(messages: ChatMessage[]): RenderedLine[] {
  const lines: RenderedLine[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push({ text: '' });
      lines.push({ text: `  \x1b[1;34m You \x1b[0m  ${msg.content}` });
    } else if (msg.role === 'assistant') {
      // Split content into individual lines
      const contentLines = msg.content.split('\n');
      const firstLine = contentLines[0] ?? '';

      lines.push({ text: '' });
      lines.push({ text: `  \x1b[1;35m Claude \x1b[0m  ${firstLine}` });

      for (let i = 1; i < contentLines.length; i++) {
        lines.push({ text: `            ${contentLines[i]}` });
      }
    } else if (msg.role === 'system') {
      lines.push({ text: '' });
      lines.push({ text: `  \x1b[2m[system] ${msg.content}\x1b[0m` });
    }
  }

  return lines;
}
