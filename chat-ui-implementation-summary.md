# Chat UI Implementation Summary (Agent 3)

## What was implemented (P0 + P1)

### P0: Auto-growing textarea with internal scroll cap
- **File**: `src/features/chat/HermedianView.ts`
- Added `input` event listener to `this.inputEl` that:
  - Sets height to `auto`
  - Caps at `INPUT_MAX_HEIGHT = 160px`
  - Enables internal `overflow-y: auto` when content exceeds max height
- **CSS**: Updated `.hermedian-input` to have `min-height: 36px`, `max-height: 160px`, `padding: 8px 4px`, `border: none`, `background: transparent`, and removed transition
- Behavior: Input grows with typing up to max height, then scrolls internally (chat messages remain in separate scroll zone)

### P1: Custom Model Selector Popup (replaces 3 <select> dropdowns)
- **New file**: `src/features/chat/ModelSelectorPopup.ts`
  - Creates a pill button that opens a popup above the composer
  - Popup shows provider groups (NVIDIA NIM, Nous Research, etc.) as optgroup-style headers
  - Hovering over a model opens a flyout submenu to the right with:
    - Thinking toggle (on/off)
    - Effort level pills (None, Minimal, Low, Medium, High, High+, Max, Ultra)
  - Clicking a model selects it and closes popup
  - Supports dynamic model loading from `~/.hermes/provider_models_cache.json`
  - Falls back to static free-model list if cache unavailable
  - Includes "Refresh models from Hermes..." and "Edit models / preferences..." actions
  - Proper keyboard accessibility (Enter/Space to toggle popup, Esc to close)
  - Click outside closes popup
- **Integration in HermedianView**:
  - Removed `modelSelectEl`, `providerSelectEl`, `reasoningSelectEl`
  - Added `modelSelector: ModelSelectorPopup | null`
  - Initialized with callbacks for model change, options change, refresh, and edit
  - Edit action opens Hermes settings tab
  - Model selector state syncs with plugin settings (`hermes.model`, `hermes.effortLevel`, `hermes.thinkingEnabled`)

### CSS Updates (`styles.css`)
- Removed old `.hermedian-model-select`, `.hermedian-provider-select`, `.hermedian-reasoning-select` styles
- Added:
  - `.hermedian-model-pill` (trigger button styling)
  - `.hermedian-model-popup` (main popup container)
  - `.hermedian-model-submenu` (hover flyout for thinking/effort options)
  - Updated `.hermedian-composer` to be a single bordered container with `align-items: flex-end` so growing textarea pushes controls down
  - Added focus states and hover effects matching Hermes Agent Desktop

## Verification
- ✅ `npm run typecheck` passes
- UI matches Hermes Agent Desktop interaction patterns:
  - Auto-growing input with internal scroll
  - Model selector popup with provider groups
  - Hover submenu for thinking and effort options
  - Send/stop button toggle
  - Attach button (file picker stub)
  - History sidebar (clock icon)
  - TabManager ready (needs tab bar UI)

## Next Steps (P2-P4)
- **P2**: Tab bar UI (horizontal strip above/below header with conversation titles and close buttons)
- **P3**: Attachment chips UI (show attached files as dismissible chips above composer)
- **P4**: Further refine animations and timing to match Hermes Desktop exactly
- **P5**: Integrate real Hermes backend streaming (already partially implemented in sendMessage)
- **P6**: Add tool call/result rendering in chat messages

Would you like me to continue with any of these, or is the current chat UI sufficient for now?