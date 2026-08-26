# Agentic Workflow Guide: Building Hermedian with Swarming Agents

This document describes how to orchestrate multiple AI agents to build Hermedian **fast, correctly, and in parallel**. Designed for use with Hermes Agent, Claude Code, Codex, or any coding agent that can read/write files and run commands.

---

## Agent Roles & Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR (You / Lead Agent)                     │
│  • Owns the master plan (this document)                                     │
│  • Delegates workstreams to specialist agents                               │
│  • Resolves cross-cutting conflicts                                         │
│  • Merges PRs, verifies integration                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────┬───────────┼───────────────┬───────────────┐
        ▼               ▼           ▼               ▼               ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  CORE AGENT   │ │PROVIDER   │ │  CHAT     │ │  INLINE   │ │  INFRA    │
│  (runtime)    │ │ AGENT     │ │  AGENT    │ │  EDIT     │ │  AGENT    │
├───────────────┤ ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤
│ • Execution   │ │ • Hermes  │ │ • View    │ │ • Modal   │ │ • Build   │
│   lifecycle   │ │   CLI     │ │ • Tabs    │ │ • Diff    │ │ • CI/CD   │
│ • Warm pool   │ │ • JSON    │ │ • Composer│ │ • Mention │ │ • Linting │
│ • Session     │ │   stream  │ │ • History │ │ • @/$     │ │ • Types   │
│ • Events      │ │ • History │ │ • Settings│ │ • Preview │ │ • Tests   │
└───────────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

---

## Workstream Definitions

### Workstream 1: Core Runtime (CRITICAL PATH)
**Files:** `src/core/execution/*`, `src/core/providers/*`, `src/core/types/*`

**Deliverables:**
- `ProviderRegistry` — registration, lookup, capabilities
- `ProviderExecutionBackend/Session` — interfaces + base classes
- `ProviderExecutionLifecycleRegistry` — generation-based leases
- `WarmExecutionPool` — LRU process capping
- `ProviderInteractionPort` — approval/question UI bridge
- Type definitions: `ChatMessage`, `Conversation`, `HermedianSettings`, `ToolCallInfo`

**Dependencies:** None (starts first)

**Definition of Done:**
- `npm run typecheck` passes
- Unit tests for pool LRU, lifecycle registry
- No circular imports

---

### Workstream 2: Hermes Provider Adapter
**Files:** `src/providers/hermes/*`

**Deliverables:**
- `HermesExecutionBackend` — creates `HermesExecutionSession`
- `HermesExecutionSession` — spawns `hermes chat --json`, parses streaming JSON
- `HermesConversationHistoryService` — session persistence
- `HermesChatUIConfig` — model options, effort levels
- Settings: `getHermesProviderSettings`, `updateHermesProviderSettings`
- Registration: `hermesProviderRegistration`

**Dependencies:** Workstream 1 (core types + registry)

**Definition of Done:**
- `hermes chat --json` works end-to-end
- Streaming events: `text_delta`, `tool_start`, `tool_output`, `completed`, `error`
- Session resume via session ID
- Settings UI reflects all Hermes options

---

### Workstream 3: Chat Feature (UI)
**Files:** `src/features/chat/*`, `src/main.ts`

**Deliverables:**
- `HermedianView` — sidebar ItemView with header, messages, input
- `TabManager` — multi-tab, provisional/cold/warm lifecycle
- `Composer` — textarea + @mention + /commands + $skills
- `MessageRenderer` — streaming text, tool calls, markdown
- `ConversationController` — load/save/switch conversations
- `InputController` — Enter/Shift+Enter, send, stop
- History sidebar (clock icon) — list, reopen, delete

**Dependencies:** Workstream 1 (core), Workstream 2 (provider)

**Definition of Done:**
- Open view → send message → see streamed reply
- Multiple tabs work independently
- Conversations persist across reloads
- History sidebar shows past chats, reopen restores session

---

### Workstream 4: Inline Edit
**Files:** `src/features/inline-edit/*`

**Deliverables:**
- `InlineEditModal` — CodeMirror 6 widget decorations
- Selection mode (highlighted text) + cursor mode (context)
- `@mention` resolver (vault files, external paths, agents)
- `/command` and `$skill` dropdown
- Diff preview (word-level, accept/reject)
- `continueConversation` for iterative edits

**Dependencies:** Workstream 1 (core), Workstream 3 (composer primitives)

**Definition of Done:**
- Select text → hotkey → modal opens with diff
- Accept → replaces text in editor
- @mention inserts file path, $skill inserts template

---

### Workstream 5: Settings & Persistence
**Files:** `src/features/settings/*`, `src/app/*`

**Deliverables:**
- `HermedianSettingTab` — all Hermes settings (CLI path, model, effort, safe mode, MCP, env vars)
- `ConversationRepository` — CRUD + input ledger + fork/rewind
- `SharedAppStorage` — settings + tab state + session metadata
- `ProviderSettingsCoordinator` — model change → defaults, env change → invalidation
- Environment variable management (shared + provider-scoped)

**Dependencies:** Workstream 1 (core), Workstream 2 (provider settings)

**Definition of Done:**
- Settings tab saves/loads correctly
- Model change applies provider defaults
- Env var change invalidates warm sessions
- Conversations persist with full metadata

---

### Workstream 6: Infrastructure & Quality
**Files:** `esbuild.config.mjs`, `tsconfig.json`, `.github/workflows/*`, `scripts/*`, `tests/*`

**Deliverables:**
- TypeScript strict config (no `any`, strict null checks)
- esbuild: dev (watch) + prod (minified)
- ESLint: `eslint-plugin-obsidianmd` + typescript-eslint
- Jest: unit tests for core runtime
- Architecture boundary tests (no feature → core imports)
- GitHub Actions: typecheck + lint + build on PR
- Release workflow: tag → build → provenance attestation

**Dependencies:** None (runs in parallel)

**Definition of Done:**
- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` passes
- `npm run build` produces `main.js`, `manifest.json`, `styles.css`
- CI passes on PR

---

## Parallel Execution Strategy

### Phase 1: Foundation (Week 1)
```
Day 1-2:  Workstream 1 (Core) + Workstream 6 (Infra)  ← START TOGETHER
Day 3-4:  Workstream 2 (Provider) depends on WS1
Day 5:    Integration test: Core + Provider
```

### Phase 2: UI & Features (Week 2)
```
Day 1-2:  Workstream 3 (Chat) depends on WS1+WS2
Day 3-4:  Workstream 5 (Settings/Persistence) depends on WS1+WS2
Day 5:    Workstream 4 (Inline Edit) depends on WS1+WS3
```

### Phase 3: Integration & Polish (Week 3)
```
Day 1-2:  Cross-workstream integration testing
Day 3:    E2E scenarios (chat → inline edit → history → settings)
Day 4:    Performance profiling, warm pool tuning
Day 5:    Release prep, BRAT testing
```

---

## Agent Communication Protocol

### Handoff Format (between agents)

```markdown
## HANDOFF: [Workstream Name] → [Next Workstream]

### What was built
- [ ] File: `path/to/file.ts` — [one-line description]
- [ ] ...

### Contract fulfilled
- Exports: `ClassName`, `functionName`, `type Name`
- Behavior: [key behaviors, e.g., "WarmPool.acquire() throws if limit reached"]

### Integration points
- Import from: `import { X } from '@/core/execution'`
- Implement: `interface ProviderExecutionBackend { ... }`
- Settings keys: `settings.hermes.cliPath`, `settings.sharedEnvironmentVariables`

### Known limitations / TODOs
- [ ] Item needing follow-up
```

### Daily Sync (5 min async)
Each agent posts in shared channel:
```
**WS[N] - [Agent Name] - [Date]**
✅ Done: [2-3 bullets]
🔄 In progress: [1 bullet]
🚫 Blocked: [if any — tag orchestrator]
📋 Next: [1 bullet]
```

---

## Code Standards (Enforced by CI)

| Rule | Tool | Config |
|------|------|--------|
| No `any` | TypeScript | `strict: true`, `noImplicitAny: true` |
| No unused vars | ESLint | `@typescript-eslint/no-unused-vars: error` |
| Import sort | ESLint | `eslint-plugin-simple-import-sort` |
| Obsidian API | ESLint | `eslint-plugin-obsidianmd` |
| Architecture boundaries | Custom test | `scripts/check-architecture-boundaries.test.mjs` |

### Architecture Boundary Rules
```
✅ ALLOWED                          ❌ FORBIDDEN
─────────────────                   ─────────────────
core → (nothing)                    core → features/*
features/* → core/*                 features/* → features/* (except shared)
features/* → shared/*               features/* → app/*
providers/* → core/*                providers/* → features/*
app/* → core/*                      app/* → providers/* (use interfaces)
shared/* → (nothing)                shared/* → anything
```

---

## Testing Strategy

### Unit Tests (per workstream)
```typescript
// tests/core/execution/WarmExecutionPool.test.ts
test('LRU eviction cools oldest session', async () => {
  const pool = new WarmExecutionPool(() => 2);
  await pool.acquire(owner1);
  await pool.acquire(owner2);
  await pool.acquire(owner3); // should cool owner1
  expect(pool.getWarmCount()).toBe(2);
});
```

### Integration Tests (cross-workstream)
```typescript
// tests/integration/chat-flow.test.ts
test('chat → history → reopen restores session', async () => {
  const view = await openChatView();
  await view.sendMessage('Hello');
  await view.waitForReply();
  const sessionId = view.getCurrentSessionId();
  
  await view.close();
  await view.reopen();
  await view.openHistory();
  await view.reopenConversation(sessionId);
  
  expect(view.getCurrentSessionId()).toBe(sessionId);
});
```

### Architecture Tests
```typescript
// scripts/check-architecture-boundaries.test.mjs
test('no feature imports from another feature', () => {
  const violations = findImportsViolating('features/*', 'features/*');
  expect(violations).toEqual([]);
});
```

---

## Conflict Resolution

| Conflict Type | Resolution |
|---------------|------------|
| **Type mismatch at boundary** | Owner of interface (core) decides; consumer adapts |
| **Duplicate utility** | Move to `shared/`; both depend on it |
| **Circular import** | Extract shared type to `core/types/` |
| **Behavior disagreement** | Orchestrator decides; document in `ARCHITECTURE_DECISIONS.md` |
| **Performance regression** | Revert + profile; owner of hot path fixes |

---

## Definition of Done (Project Level)

- [ ] `npm run build` produces valid Obsidian plugin (3 files)
- [ ] Install in vault → enable → chat works
- [ ] Send message → streamed reply from Hermes CLI
- [ ] Conversation persists across reloads
- [ ] Settings save/load correctly
- [ ] Inline edit opens, shows diff, accepts
- [ ] All CI checks pass
- [ ] No `any` types in production code
- [ ] Architecture boundary tests pass
- [ ] README + CONTRIBUTING.md complete

---

## Quick Start for New Agents

```bash
# 1. Clone & setup
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/yrarjun59/hermedian.git
cd hermedian
npm install

# 2. Understand architecture
cat ARCHITECTURE_COMPARISON.md
cat AGENTIC_WORKFLOW.md  # this file

# 3. Pick a workstream, read its files
# 4. Run dev build
npm run dev

# 5. Test in Obsidian (enable plugin, open view)
# 6. Write code, run typecheck/lint/test
npm run typecheck && npm run lint && npm test

# 7. Create PR with handoff format
```

---

## Useful Commands

```bash
# Development
npm run dev           # Watch mode (esbuild + CSS)
npm run build         # Production build

# Quality
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run lint:fix      # Auto-fix
npm test              # Jest unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Architecture
node --test scripts/check-architecture-boundaries.test.mjs

# Obsidian integration
# Symlink built files to vault for live testing:
ln -sf /path/to/hermedian/main.js /path/to/vault/.obsidian/plugins/hermedian/main.js
ln -sf /path/to/hermedian/styles.css /path/to/vault/.obsidian/plugins/hermedian/styles.css
ln -sf /path/to/hermedian/manifest.json /path/to/vault/.obsidian/plugins/hermedian/manifest.json
```

---

## Escalation Path

```
Agent stuck > 2 hours
       │
       ▼
Post in #hermedian-dev with:
  • What you tried
  • Error/logs
  • Hypothesis
       │
       ▼
Orchestrator triages:
  • Quick fix → unblocks in 15 min
  • Design decision → 30 min sync
  • Refactor needed → reassign workstream
```

---

*This workflow enabled Claudian to reach 5.6k⭐ with a small team. Adapt it, don't adopt it blindly.*