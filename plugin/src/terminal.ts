import { execSync, spawn } from 'node:child_process';
import { platform } from 'node:os';

export type Multiplexer = 'tmux' | 'iterm2' | 'kitty' | 'wezterm' | 'windows-terminal' | 'none';

/**
 * Detect the current terminal multiplexer/emulator.
 */
export function detectMultiplexer(): Multiplexer {
  // Check tmux
  if (process.env.TMUX) {
    return 'tmux';
  }

  // Check iTerm2
  if (process.env.TERM_PROGRAM === 'iTerm.app') {
    return 'iterm2';
  }

  // Check Kitty
  if (process.env.TERM === 'xterm-kitty' || process.env.KITTY_PID) {
    return 'kitty';
  }

  // Check WezTerm
  if (process.env.TERM_PROGRAM === 'WezTerm') {
    return 'wezterm';
  }

  // Check Windows Terminal
  if (process.env.WT_SESSION) {
    return 'windows-terminal';
  }

  return 'none';
}

/**
 * Split the terminal and run a command in the new pane.
 */
export function splitPane(
  command: string,
  options: {
    direction?: 'horizontal' | 'vertical';
    size?: number; // percentage
  } = {},
): boolean {
  const { direction = 'vertical', size = 30 } = options;
  const mux = detectMultiplexer();

  switch (mux) {
    case 'tmux':
      return tmuxSplit(command, direction, size);

    case 'iterm2':
      return iterm2Split(command, direction);

    case 'kitty':
      return kittySplit(command, direction);

    case 'wezterm':
      return weztermSplit(command, direction);

    case 'windows-terminal':
    case 'none':
      // Fall back to new terminal window
      return openNewTerminal(command);
  }
}

function tmuxSplit(command: string, direction: string, size: number): boolean {
  try {
    const flag = direction === 'horizontal' ? '-v' : '-h';
    execSync(`tmux split-window ${flag} -p ${size} '${command}'`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function iterm2Split(command: string, direction: string): boolean {
  try {
    const splitDir = direction === 'horizontal' ? 'horizontally' : 'vertically';
    const script = `
      tell application "iTerm2"
        tell current session of current window
          split ${splitDir} with default profile command "${command}"
        end tell
      end tell
    `;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function kittySplit(command: string, direction: string): boolean {
  try {
    const loc = direction === 'horizontal' ? 'hsplit' : 'vsplit';
    execSync(`kitty @ launch --location ${loc} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function weztermSplit(command: string, direction: string): boolean {
  try {
    const dir = direction === 'horizontal' ? '--bottom' : '--right';
    execSync(`wezterm cli split-pane ${dir} -- ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function openNewTerminal(command: string): boolean {
  try {
    const isWin = platform() === 'win32';
    const isMac = platform() === 'darwin';

    if (isWin) {
      spawn('cmd', ['/c', 'start', 'cmd', '/k', command], { detached: true, stdio: 'ignore' });
    } else if (isMac) {
      execSync(`open -a Terminal "${command}"`, { stdio: 'ignore' });
    } else {
      // Try xterm, gnome-terminal, etc.
      const terminals = ['xterm', 'gnome-terminal', 'konsole', 'xfce4-terminal'];
      for (const term of terminals) {
        try {
          spawn(term, ['-e', command], { detached: true, stdio: 'ignore' });
          return true;
        } catch {
          continue;
        }
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create the full canvas layout (3 panes).
 */
export function createCanvasLayout(): boolean {
  const mux = detectMultiplexer();

  if (mux === 'tmux') {
    try {
      // Create left pane (file explorer, 20%)
      execSync("tmux split-window -h -p 80 'echo CCR Explorer; read'", { stdio: 'ignore' });
      // Create right pane (preview, 30%)
      execSync("tmux split-window -h -p 30 'echo CCR Preview; read'", { stdio: 'ignore' });
      // Focus center pane
      execSync('tmux select-pane -t 1', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  // For other multiplexers, fall back to web IDE
  return false;
}
