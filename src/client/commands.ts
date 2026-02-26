import type { ChatMessage } from './hooks/useTerminal.js';

export interface CommandContext {
  addSystemMessage: (content: string) => void;
  clearMessages: () => void;
  sendRawKey: (data: string) => void;
  createSession: (name?: string) => void;
  refreshSessions: () => void;
  toggleSidebar: () => void;
  exitApp: () => void;
  switchToRaw: () => void;
}

export interface CommandDef {
  name: string;
  aliases: string[];
  description: string;
  handler: (args: string, ctx: CommandContext) => boolean;
}

const commands: CommandDef[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    handler: (_args, ctx) => {
      const lines = [
        '--- CCR Commands ---',
        '/help, /h, /?          Show this help',
        '/clear, /cls           Clear chat messages',
        '/sessions, /ls         Show session list sidebar',
        '/new [name]            Create a new session',
        '/refresh               Refresh session list',
        '/raw                   Switch to raw mode',
        '/quit, /exit, /q       Quit CCR',
        '',
        '--- Claude Code Commands ---',
        'You can also use Claude Code CLI commands:',
        '/compact               Compact conversation',
        '/model                 Switch model',
        '/cost                  Show token usage',
        '/clear                 Clear conversation',
        '',
        'Any /command not recognized here is forwarded to Claude Code CLI.',
      ];
      ctx.addSystemMessage(lines.join('\n'));
      return true;
    },
  },
  {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear chat messages',
    handler: (_args, ctx) => {
      ctx.clearMessages();
      ctx.addSystemMessage('Chat cleared.');
      return true;
    },
  },
  {
    name: 'sessions',
    aliases: ['ls'],
    description: 'Toggle session list',
    handler: (_args, ctx) => {
      ctx.toggleSidebar();
      return true;
    },
  },
  {
    name: 'new',
    aliases: [],
    description: 'Create a new session',
    handler: (args, ctx) => {
      ctx.createSession(args || undefined);
      ctx.addSystemMessage(`Creating new session${args ? `: ${args}` : ''}...`);
      return true;
    },
  },
  {
    name: 'refresh',
    aliases: ['r'],
    description: 'Refresh session list',
    handler: (_args, ctx) => {
      ctx.refreshSessions();
      ctx.addSystemMessage('Refreshing sessions...');
      return true;
    },
  },
  {
    name: 'raw',
    aliases: [],
    description: 'Switch to raw mode',
    handler: (_args, ctx) => {
      ctx.switchToRaw();
      return true;
    },
  },
  {
    name: 'quit',
    aliases: ['exit', 'q'],
    description: 'Quit CCR',
    handler: (_args, ctx) => {
      ctx.exitApp();
      return true;
    },
  },
];

/**
 * Process a /command. Returns true if handled locally.
 * Unrecognized commands should be forwarded to Claude Code CLI.
 */
export function handleCommand(cmd: string, args: string, ctx: CommandContext): boolean {
  const lowerCmd = cmd.toLowerCase();

  for (const def of commands) {
    if (def.name === lowerCmd || def.aliases.includes(lowerCmd)) {
      return def.handler(args, ctx);
    }
  }

  // Not a local command - will be forwarded to Claude Code
  return false;
}
