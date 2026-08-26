# Architecture Comparison: Hermedian vs Claudian vs jsun2020/hermes-agent-obsidian-plugin

## Executive Summary

| Aspect | **Claudian** | **jsun2020/hermes-agent-obsidian-plugin** | **Hermedian** |
|--------|--------------|-------------------------------------------|---------------|
| **Transport** | CLI subprocess (Claude Code, Codex, Grok, OpenCode, Pi) | HTTP Gateway (`http://127.0.0.1:8642`) | **CLI subprocess (Hermes Agent)** |
| **Architecture** | Multi-provider registry, lazy workspace init | Single-purpose, gateway client | Single-provider, CLI-first |
| **File Access** | Native (vault = cwd) | Via gateway sandbox (Codex) | **Native (vault = cwd)** |
| **Session Mgmt** | Native history + provider-state | Local `history.json` + gateway `state.db` | Native history (planned) |
| **Providers** | 5+ (Claude, Codex, Grok, OpenCode, Pi) | 1 (Hermes Gateway) | **1 (Hermes CLI)** |
| **Collab** | LAN Git-based | None | Planned (LAN Git) |
| **Smart Graph** | No | **Yes (agent-built semantic graph)** | Planned |
| **Inline Edit** | CodeMirror 6 diff widgets | No | **Planned (CodeMirror 6)** |
| **MCP** | Via provider CLIs | Gateway config | Planned |
| **Maturity** | Production (5.6k ⭐) | Beta (11 ⭐) | **Early scaffold** |

---

## Deep Dive: Key Differences

### 1. Transport Layer

**Claudian / Hermedian (CLI subprocess)**
```
┌─────────────┐     spawn      ┌──────────────────┐
│   Obsidian  │ ─────────────▶ │  hermes/claude   │
│  (plugin)   │  stdin/stdout  │  (CLI process)   │
└─────────────┘  JSON streaming └──────────────────┘
       │                              │
       ▼                              ▼
  Vault files                   File tools (read/write/
  (working dir)                 glob/grep/bash)
```

**jsun2020 plugin (HTTP Gateway)**
```
┌─────────────┐     HTTP       ┌─────────────┐     subprocess     ┌──────────┐
│   Obsidian  │ ─────────────▶ │   Gateway   │ ─────────────────▶ │  Codex   │
│  (plugin)   │  REST + SSE    │ (port 8642) │  Codex CLI / TUI   │ (sandbox)│
└─────────────┘                └─────────────┘                    └──────────┘
       │                              │
       ▼                              ▼
  Local history.json          state.db (SQLite)
  (plugin-owned)              (gateway-owned)
```

**Why Hermedian chose CLI:**
- ✅ No separate gateway process to manage
- ✅ Native file access (no sandbox/escalation issues)
- ✅ Works offline / air-gapped
- ✅ Simpler mental model: one process tree

---

### 2. File Access & Sandbox

| | Claudian / Hermedian | jsun2020 plugin |
|---|---------------------|-----------------|
| **Working dir** | Vault root (native) | Gateway launch dir (hardcoded) |
| **Write access** | Direct (if approved) | Requires Codex `sandbox_mode = "workspace-write"` |
| **Read outside cwd** | Works | Escalated → auto-denied in non-interactive runs |
| **Fix** | N/A (native) | Edit `~/.codex/config.toml` + restart gateway |

**The Codex sandbox problem** (from jsun2020 README):
> "The gateway's `/v1/runs` endpoint exposes **no way for an API client to set a per-run working directory**... So if your vault is not the gateway's launch directory, file reads fall *outside* the sandbox."

Hermedian avoids this entirely — the Hermes CLI runs **with the vault as cwd**.

---

### 3. Session & History Management

**Claudian:**
- Provider-native history (Claude JSONL, Codex JSONL)
- `ConversationRepository` with input ledger
- Fork/rewind/missing-session recovery
- Model recovery from native history

**jsun2020 plugin:**
- Local `history.json` (plugin-owned, 100 most recent)
- Gateway `state.db` (SQLite, separate)
- Session ID passed back to gateway for continuity

**Hermedian (planned):**
- Follow Claudian's `ConversationRepository` pattern
- Store session IDs in conversation metadata
- Support fork/rewind via Hermes native sessions

---

### 4. Smart Graph (jsun2020 unique feature)

```
┌─────────────────────────────────────────────────┐
│ 1. Plugin gathers: title + excerpt + wikilinks │
│    from ALL notes (capped by max_notes)        │
├─────────────────────────────────────────────────┤
│ 2. Sends to Hermes in single call              │
│    "Analyze semantic relationships..."         │
├─────────────────────────────────────────────────┤
│ 3. Hermes returns:                              │
│    { nodes: [{id, title, group}],              │
│      edges: [{source, target, strength, type}] }│
├─────────────────────────────────────────────────┤
│ 4. Force-directed graph (D3/cytoscape)         │
│    - Click node → open note                    │
│    - Semantic edges (accent) vs wikilinks      │
│    - Cached to graph-cache.json                │
└─────────────────────────────────────────────────┘
```

**Hermedian should add this** — it's a killer feature for vault exploration.

---

### 5. Architecture Patterns Worth Adopting

| Pattern | From | Why |
|---------|------|-----|
| **Dual registry** (chat-facing + workspace) | Claudian | Clean separation, lazy init |
| **Warm execution pool (LRU)** | Claudian | Cap concurrent processes |
| **Generation-based invalidation** | Claudian | Clean session reset on env changes |
| **Provider-neutral core** | Claudian | Extensible (even if single-provider now) |
| **Gateway capability detection** | jsun2020 | Auto-detect Runs vs Chat Completions |
| **Native folder picker for workspace** | jsun2020 | Better UX than path input |
| **Context gauge (token usage donut)** | jsun2020 | Visibility into context consumption |
| **Smart graph** | jsun2020 | Semantic vault exploration |

---

## What Hermedian Needs to Build

### Phase 1: Core Functionality (Current Sprint)
- [x] Plugin scaffold, chat view, settings
- [ ] **Hermes CLI JSON streaming** (`hermes chat --json`)
- [ ] **Conversation persistence** (Claudian-style `ConversationRepository`)
- [ ] **Session management** (resume, fork, rewind)
- [ ] **Inline edit** (CodeMirror 6 diff widgets)

### Phase 2: UX Polish
- [ ] **Native folder picker** for working directory (jsun2020 style)
- [ ] **Context gauge** (token usage donut in footer)
- [ ] **Model auto-detection** from `~/.hermes/config.yaml`
- [ ] **Test connection** button with transport detection
- [ ] **History sidebar** (clock icon, reopen with session ID)

### Phase 3: Advanced Features
- [ ] **Smart graph** (semantic vault analysis)
- [ ] **MCP integration** (via Hermes CLI config)
- [ ] **Collab mode** (LAN Git-based, like Claudian)
- [ ] **Plan mode** (Shift+Tab toggle)
- [ ] **Slash commands / skills** (`/`, `$`)

### Phase 4: Production Ready
- [ ] Community plugin submission
- [ ] BRAT support
- [ ] Automated releases with provenance
- [ ] Multi-platform testing (Linux/Windows/macOS)

---

## Decision: Stick with CLI Architecture

**Don't switch to HTTP gateway.** The CLI approach is:
1. **Simpler** — no separate process to run
2. **More reliable** — no network/auth/sandbox issues
3. **True offline** — works without Hermes Desktop
4. **Aligned with Hermes Agent** — CLI is the primary interface

**Adopt jsun2020's UX patterns** (folder picker, context gauge, smart graph) but implement them **over the CLI transport**.

---

## File Structure Comparison

```
Claudian (full)              jsun2020 (focused)         Hermedian (target)
─────────────────────        ─────────────────────      ─────────────────────
src/
  core/                        src/                         src/
    providers/                  main.ts                       core/
    execution/                  chat-view.ts                  providers/
    bootstrap/                  settings.ts                   execution/
    collab/                     gateway.ts                    bootstrap/
    tools/                      history.ts                    types/
    types/                      smart-graph.ts                tools/
  providers/                   types.ts                      types/
    claude/                                              providers/hermes/
    codex/                                                 execution/
    grok/                                                  history/
    opencode/                                              ui/
    pi/                                                    settings/
    acp/                                                   types/
  features/
    chat/                                              features/
    collab/                                                chat/
    inline-edit/                                           inline-edit/
    settings/                                              settings/
  app/                                                   (no app/ - simpler)
    collab/
    agent-runtime/
```

**Hermedian keeps Claudian's core architecture** (it's battle-tested) but **simplifies providers to just Hermes**.