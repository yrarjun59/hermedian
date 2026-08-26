# Hermedian

**Hermes Agent embedded in Obsidian sidebar** — your vault becomes the agent's working directory.

> Hermedian is a fork of [Claudian](https://github.com/YishenTu/claudian) focused specifically on Hermes Agent integration with Obsidian.

## Features

- 💬 **Chat sidebar** — Talk to Hermes Agent inside Obsidian
- 📁 **Vault = working directory** — Agent reads, writes, edits, searches in your actual vault
- ✏️ **Inline edit** — Select text → hotkey → agent edits directly with diff preview
- 🔧 **MCP servers** — Connect external tools via Hermes Agent's native MCP config
- 🌐 **Free/offline-first** — Works with local models + free APIs
- 🔒 **Privacy-focused** — No telemetry, no cloud dependency

## Requirements

- [Hermes Agent CLI](https://github.com/yourorg/hermes-agent)
- [Obsidian](https://obsidian.md) v1.13.0+
- Desktop only (macOS, Linux, Windows)

## Installation

### From Obsidian Community Plugins (coming soon)

### From source

```bash
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/yrarjun59/hermedian.git
cd hermedian
npm install
npm run build
```

Then enable the plugin in Obsidian: Settings → Community plugins → Enable "Hermedian"

## Usage

- **Open chat**: Click the robot icon in the ribbon, or use command palette → "Open chat view"
- **Inline edit**: Select text → `Shift+Enter` (configurable)
- **New conversation**: `Ctrl+N` or click the + button

## Architecture

```
src/
├── main.ts                      # Plugin entry point
├── core/                        # Provider-neutral runtime
│   ├── providers/               # Registry, types, settings
│   ├── execution/               # Backend, session, events, warm pool
│   ├── bootstrap/               # Storage, sessions
│   └── types/                   # Shared contracts
├── providers/hermes/            # Hermes Agent adapter
│   ├── execution/               # CLI process, JSON streaming
│   ├── history/                 # Conversation persistence
│   └── ui/                      # Model selector config
├── features/
│   ├── chat/                    # Sidebar chat view
│   ├── settings/                # Settings tab
│   └── inline-edit/             # (coming) Modal + diff preview
└── shared/                      # Reusable components
```

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — Hermedian Contributors