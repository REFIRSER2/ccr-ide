# /ccr-explorer

Open a file explorer panel in a split terminal pane.

## Usage

```
/ccr-explorer [directory]
```

## Description

Opens an interactive file explorer in a split terminal pane. Allows browsing the session's working directory with keyboard navigation.

## Behavior

1. Detects terminal multiplexer
2. Opens a narrow vertical split pane on the left
3. Displays directory tree with expand/collapse
4. Navigate with arrow keys, Enter to open
5. Selected files are sent to the Claude Code session for context

## Controls

- `j/k` or arrow keys: Navigate up/down
- `Enter`: Open file / toggle directory
- `l/h` or right/left: Expand / collapse directory
- `q`: Close explorer
- `/`: Search files

## Examples

```
/ccr-explorer
/ccr-explorer ./src
```
