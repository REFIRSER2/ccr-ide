# /ccr-canvas

Open the full CCR IDE layout with explorer, terminal, and preview panels.

## Usage

```
/ccr-canvas
```

## Description

Launches the full CCR IDE experience by creating a multi-pane terminal layout:

- **Left pane**: File explorer (narrow)
- **Center pane**: Claude Code terminal (main)
- **Right pane**: File preview / editor output

Alternatively, opens the Web IDE in a browser if a CCR server is running.

## Behavior

### Terminal Multiplexer Mode (tmux/similar)
1. Creates a 3-pane layout using tmux split commands
2. Left: File explorer (20% width)
3. Center: Current Claude Code session
4. Right: Preview panel (30% width)

### Web IDE Mode
1. Checks if CCR server is running locally
2. Opens `http://localhost:3100` in the default browser
3. Web IDE provides the full 3-panel layout with mobile support

## Requirements

- tmux, iTerm2, Kitty, WezTerm, or Windows Terminal for pane mode
- OR a running CCR server for web IDE mode

## Examples

```
/ccr-canvas
```
