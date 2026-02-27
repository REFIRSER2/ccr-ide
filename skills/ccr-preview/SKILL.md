---
name: ccr-preview
description: Preview a file in a split terminal pane or separate window
---

Preview a file in a split terminal pane or separate window.

## Usage

```
/ccr-preview <file-path>
```

## Description

Opens a file preview in a split terminal pane (tmux/iTerm2/Kitty/WezTerm) or a new terminal window. Supports:

- Code files with syntax highlighting
- Markdown rendered preview
- Image files (in supported terminals)
- JSON formatted view

## Behavior

1. Detects the current terminal multiplexer (tmux, iTerm2, Kitty, WezTerm, Windows Terminal)
2. Opens a vertical split pane (or new window if no multiplexer)
3. Displays the file content with appropriate formatting
4. Watches for file changes and auto-refreshes
5. Close the pane to exit preview

## Examples

```
/ccr-preview src/index.ts
/ccr-preview README.md
/ccr-preview package.json
```
