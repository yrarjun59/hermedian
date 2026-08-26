# Hermedian

**Hermes Agent embedded in Obsidian sidebar** — your vault becomes the agent's working directory.

Inspired by [Claudian](https://github.com/YishenTu/claudian) and [jsun2020/hermes-agent-obsidian-plugin](https://github.com/jsun2020/hermes-agent-obsidian-plugin).

## What is this?

Hermedian is an Obsidian plugin that embeds **Hermes Agent** (the local-first, free, offline-capable AI coding agent) directly in your vault. Unlike HTTP-gateway plugins, Hermedian **spawns the Hermes CLI as a subprocess**, giving you:

| Capability | How it works |
|------------|--------------|
| **File read/write** | Hermes uses native file tools against your vault |
| **Search (grep/glob)** | Runs ripgrep/fd inside your vault |
| **Bash execution** | Commands run with vault as working directory |
| **Multi-step workflows** | Agent plans → executes → verifies |
| **No gateway needed** | No separate HTTP server, no API keys |

## Requirements

- [Hermes Agent CLI](https://github.com/yourorg/hermes-agent) — installed and in PATH
- Obsidian v1.13.0+
- Desktop only (macOS, Linux, Windows)

## Install

### From source (development)

```bash
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/yrarjun59/hermedian.git
cd hermedian
npm install
npm run build
```

Enable in Obsidian: Settings → Community plugins → Enable "Hermedian"

## Usage

- **Open chat**: Ribbon icon (bot) or command palette → "Open chat view"
- **New conversation**: `Ctrl+N` or + button in sidebar
- **Inline edit**: Select text → hotkey → diff preview → accept
- **@mention**: Reference vault files, external paths, subagents
- **/commands**: Reusable prompt templates (vault + user scope)

## Architecture

```
src/
├── main.ts                      # Plugin entry, view registration
├── core/                        # Provider-neutral runtime
│   ├── providers/               # Registry, settings, environment
│   ├── execution/               # Backend, session, events, warm pool (LRU)
│   ├── bootstrap/               # Storage, sessions, tab migration
│   └── types/                   # Shared contracts (chat, settings, tools)
├── providers/hermes/            # Hermes Agent adapter
│   ├── execution/               # CLI process, JSON streaming
│   ├── history/                 # Conversation persistence
│   └── ui/                      # Model selector, reasoning config
├── features/
│   ├── chat/                    # Sidebar, tabs, composers, rendering
│   ├── inline-edit/             # Modal + diff preview (CodeMirror 6)
│   ├── collab/                  # (future) LAN Git-based collab
│   └── settings/                # Provider tabs, env vars, CLI path
└── shared/                      # Reusable components
```

## Status

**Early development** — chat view + settings scaffold complete. Next: inline edit, conversation persistence, Hermes CLI JSON streaming.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Architecture questions welcome in issues.

## License

[MIT](LICENSE) — Hermedian Contributors