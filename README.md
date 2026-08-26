# Hermedian

**Hermes Agent embedded in Obsidian sidebar** — your vault becomes the agent's working directory.

Inspired by [Claudian](https://github.com/YishenTu/claudian)

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
├── main.ts                      # Plugin entry point
├── core/                        # Provider-neutral runtime
│   ├── providers/               # Registry, settings, environment
│   ├── execution/               # Backend, session, events, warm pool
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

## Features

- **Chat sidebar** — Talk to Hermes Agent inside Obsidian
- **Vault = working directory** — Agent reads, writes, edits, searches in your actual vault
- **Inline edit** — Select text → hotkey → agent edits directly with diff preview
- **@mention** — Reference vault files, external paths, subagents in chat
- **/commands & $skills** — Reusable prompt templates (vault-level + user-level)
- **Plan mode** — Agent explores → proposes plan → you approve → executes
- **MCP servers** — Connect external tools via Hermes Agent's native MCP config
- **Tabs & session management** — Multiple conversations, persistent across restarts
- **Free/offline-first** — Works with local models + free NVIDIA NIM API (no paid keys)

## Requirements

- [Hermes Agent CLI](https://github.com/hermes-agent/hermes-agent) — installed and in PATH
- Obsidian v1.13.0+
- Desktop only (macOS, Linux, Windows)

## Install

### From source (development)

```bash
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/yrarjun59/hermedian.git
cd hermedian
npm install --legacy-peer-deps
npm run build
```

Enable in Obsidian: Settings → Community plugins → Enable "Hermedian"

## Usage

- **Open chat**: Ribbon icon (bot) or command palette → "Open chat view"
- **New conversation**: `Ctrl+N` or + button in sidebar
- **Inline edit**: Select text → hotkey → diff preview → accept
- **@mention**: Reference vault files, external paths, subagents
- **/commands**: Reusable prompt templates (vault + user scope)

## Settings

- **Hermes CLI path** — Path to `hermes` executable (auto-detected if empty)
- **Default model** — Choose from NVIDIA NIM models
- **Reasoning effort** — Low / Medium / High
- **Safe mode** — Auto / Ask / YOLO
- **MCP servers** — Enable external tool connections
- **Environment variables** — API keys, custom endpoints
- **Max warm processes** — Concurrent agent limit (3-10)

## Privacy & Costs

- **No telemetry** — Plugin doesn't track usage
- **Local first** — Hermes CLI runs on your machine
- **API calls** — Only your prompts + relevant context go to NVIDIA NIM
- **Free tier** — NVIDIA NIM free tier is generous for personal use
- **No lock-in** — Your notes stay as plain Markdown files

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Plugin not in list | Restart Obsidian. Check `manifest.json` exists in plugin folder |
| "Cannot reach Hermes" | Check Hermes CLI works in terminal. Verify API key in settings |
| Blank sidebar | Reload Obsidian (Cmd+R / Ctrl+R). Check DevTools Console for errors |
| Settings not saving | Check Obsidian DevTools Console for errors |
| No response from Hermes | Verify Hermes CLI works in terminal. Check API key |

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License — See [LICENSE](LICENSE) for details.

## Links

- **Hermes Agent**: [github.com/hermes-agent/hermes-agent](https://github.com/hermes-agent/hermes-agent)
- **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com)
- **Obsidian**: [obsidian.md](https://obsidian.md)

---

**Made with ❤️ for the Obsidian's community**
