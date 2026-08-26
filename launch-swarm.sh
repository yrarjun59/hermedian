#!/usr/bin/env bash
# launch-swarm.sh — Launch all 4 agents in tmux panes
# Usage: ./launch-swarm.sh
#   Opens tmux session "hermedian-swarm" with 4 panes
#   Core runs immediately; Provider/Chat wait for handoffs; Infra runs immediately

set -euo pipefail

SESSION="hermedian-swarm"
HANDOFF_DIR="/tmp/hermedian-handoff"
PROJECT_DIR="/media/k2/TDisk/CS/Builds/hermedian"

mkdir -p "$HANDOFF_DIR"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with 4 panes
tmux new-session -d -s "$SESSION" -n "swarm"

# ============================================================
# PANE 0 (top-left): CORE AGENT — Nemotron 3 Ultra
# ============================================================
tmux send-keys -t "$SESSION:0.0" "
cd $PROJECT_DIR
echo '=== CORE AGENT — STARTING ===' 
hermes chat --model nvidia/nemotron-3-ultra-550b-a55b --provider nvidia-nim \\
  -s 'You are the Core Agent. Extend src/core/execution/ and src/core/providers/.
  
  TASKS:
  1. Add ConversationRepository with input ledger (src/core/bootstrap/ConversationRepository.ts)
  2. Add fork/rewind support in execution layer
  3. Add session resume via native Hermes session IDs
  4. Export all types from src/core/execution/index.ts
  
  Write handoff to /tmp/hermedian-handoff/core-to-provider.md and core-to-chat.md when done.
  
  Context files: src/core/execution/, src/core/providers/, src/core/types/'
" C-m

# ============================================================
# PANE 1 (top-right): PROVIDER AGENT — CodeLlama 70B (WAITS)
# ============================================================
tmux split-window -h -t "$SESSION:0.0"
tmux send-keys -t "$SESSION:0.1" "
cd $PROJECT_DIR
echo '=== PROVIDER AGENT — WAITING FOR CORE HANDOFF ==='
echo ''
echo 'Watch for handoff file:'
echo '  cat /tmp/hermedian-handoff/core-to-provider.md'
echo ''
echo 'When it exists, run this command in this pane:'
echo ''
cat << 'EOF'
hermes chat --model nvidia/codellama-70b-instruct --provider nvidia-nim \\
  -s "Provider Agent: Enhance src/providers/hermes/. 
  Read handoff from /tmp/hermedian-handoff/core-to-provider.md first.
  
  TASKS:
  1. Session resume in HermesExecutionSession (pass sessionId to hermes CLI)
  2. Native history hydration in HermesConversationHistoryService
  3. MCP config support (read ~/.hermes/config.yaml)
  4. Settings wire-up: cliPath, model, effortLevel, safeMode, env vars
  
  Write handoff to /tmp/hermedian-handoff/provider-to-chat.md when done.
  
  Context files: src/providers/hermes/, src/core/providers/types.ts"
EOF
echo ''
echo '=== Press Enter after core handoff appears, then paste the command above ==='
" C-m

# ============================================================
# PANE 2 (bottom-left): CHAT/UI AGENT — Nemotron 70B (WAITS)
# ============================================================
tmux split-window -v -t "$SESSION:0.0"
tmux send-keys -t "$SESSION:0.2" "
cd $PROJECT_DIR
echo '=== CHAT/UI AGENT — WAITING FOR CORE HANDOFF ==='
echo ''
echo 'Watch for handoff files:'
echo '  cat /tmp/hermedian-handoff/core-to-chat.md'
echo '  cat /tmp/hermedian-handoff/provider-to-chat.md'
echo ''
echo 'When BOTH exist, run this command in this pane:'
echo ''
cat << 'EOF'
hermes chat --model nvidia/llama-3.1-nemotron-70b-instruct --provider nvidia-nim \\
  -s "Chat Agent: Build src/features/chat/.
  Read handoffs from /tmp/hermedian-handoff/core-to-chat.md and provider-to-chat.md.
  
  TASKS:
  1. TabManager (multi-tab, provisional/cold/warm lifecycle)
  2. Composer with @mention, /commands, \$skills
  3. MessageRenderer (streaming text, tool calls, markdown)
  4. HistorySidebar (clock icon, list, reopen with sessionId)
  5. Wire HermedianView to ProviderRegistry for send/receive
  
  Context files: src/features/chat/, src/main.ts, src/core/types/chat.ts"
EOF
echo ''
echo '=== Press Enter after core handoff appears, then paste the command above ==='
" C-m

# ============================================================
# PANE 3 (bottom-right): INFRA AGENT — Mistral-Nemotron 8B (RUNS NOW)
# ============================================================
tmux split-window -v -t "$SESSION:0.1"
tmux send-keys -t "$SESSION:0.3" "
cd $PROJECT_DIR
echo '=== INFRA AGENT — STARTING ===' 
hermes chat --model nvidia/mistral-nemotron-3-8b-instruct --provider nvidia-nim \\
  -s 'You are the Infra Agent. Fix lint, add tests, configure build.
  
  TASKS:
  1. Run npm run lint:fix until clean
  2. Add Jest unit tests for WarmExecutionPool, ProviderRegistry, ConversationRepository
  3. Add architecture boundary tests (scripts/check-architecture-boundaries.test.mjs)
  4. Fix esbuild config for production (sourcemaps, minification)
  5. Add CI script (npm run ci: typecheck + lint + test)
  
  Read /tmp/hermedian-handoff/infra-notes.md for notes from other agents.
  
  Context files: package.json, tsconfig.json, esbuild.config.mjs, scripts/, tests/'
" C-m

# ============================================================
# Attach to session
# ============================================================
tmux select-pane -t "$SESSION:0.0"
tmux attach-session -t "$SESSION"