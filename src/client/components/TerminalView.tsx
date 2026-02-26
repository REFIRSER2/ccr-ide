import React, { useState, useEffect } from 'react';
import { Box, Text, useFocus, useInput } from 'ink';

interface TerminalViewProps {
  lines: string[];
  height: number;
}

export function TerminalView({ lines, height }: TerminalViewProps) {
  const { isFocused } = useFocus({ id: 'terminal-view' });
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);

  const viewHeight = Math.max(1, height - 2); // account for border
  const maxOffset = Math.max(0, lines.length - viewHeight);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxOffset);
    }
  }, [lines.length, maxOffset, autoScroll]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setAutoScroll(false);
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const newOffset = Math.min(maxOffset, scrollOffset + 1);
      setScrollOffset(newOffset);
      if (newOffset >= maxOffset) {
        setAutoScroll(true);
      }
    } else if (key.pageUp) {
      setAutoScroll(false);
      setScrollOffset(prev => Math.max(0, prev - viewHeight));
    } else if (key.pageDown) {
      const newOffset = Math.min(maxOffset, scrollOffset + viewHeight);
      setScrollOffset(newOffset);
      if (newOffset >= maxOffset) {
        setAutoScroll(true);
      }
    } else if (input === 'g' && key.ctrl) {
      // Ctrl+G: Go to bottom
      setScrollOffset(maxOffset);
      setAutoScroll(true);
    }
  }, { isActive: isFocused });

  const visibleLines = lines.slice(scrollOffset, scrollOffset + viewHeight);

  // Scrollbar indicator
  const scrollbarPos = maxOffset > 0
    ? Math.round((scrollOffset / maxOffset) * (viewHeight - 1))
    : 0;

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleLines.map((line, i) => (
          <Text key={scrollOffset + i} wrap="truncate">
            {stripAnsiForInk(line)}
          </Text>
        ))}
        {/* Fill remaining space */}
        {visibleLines.length < viewHeight &&
          Array.from({ length: viewHeight - visibleLines.length }).map((_, i) => (
            <Text key={`empty-${i}`}> </Text>
          ))
        }
      </Box>

      {/* Scrollbar */}
      {lines.length > viewHeight && (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: viewHeight }).map((_, i) => (
            <Text key={`sb-${i}`} color={i === scrollbarPos ? 'cyan' : 'gray'}>
              {i === scrollbarPos ? '█' : '│'}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Strip ANSI escape codes that Ink can't handle directly.
 * Ink's <Text> handles basic colors via chalk, but raw ANSI cursor movements
 * and screen clearing codes need to be stripped.
 */
function stripAnsiForInk(str: string): string {
  // Remove cursor movement, screen clear, and other control sequences
  // but keep basic color codes (SGR sequences)
  return str
    // Remove cursor position sequences: ESC[H, ESC[nA, ESC[nB, etc
    .replace(/\x1b\[\d*[ABCDHJ]/g, '')
    // Remove erase sequences
    .replace(/\x1b\[\d*[KL]/g, '')
    // Remove other CSI sequences (except SGR which ends with 'm')
    .replace(/\x1b\[\??\d*[a-ln-zA-Z]/g, '')
    // Remove carriage return
    .replace(/\r/g, '')
    // Remove OSC sequences (title setting etc)
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // Remove ESC sequences that aren't CSI
    .replace(/\x1b[^[]\S/g, '');
}
