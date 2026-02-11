# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProgressiveDraw is a whiteboard application built around **progressive disclosure** — canvas objects have `appearFrame`/`disappearFrame` properties enabling timeline-based reveal for presentations.

## Commands

```bash
pnpm dev        # Start dev server (localhost:5173)
pnpm build      # TypeScript check + Vite production build
pnpm lint       # ESLint
pnpm format     # Prettier (2-space, single quotes, 100 char width, trailing commas)
pnpm preview    # Preview production build
```

No test framework is configured.

## Architecture

### Rendering

The canvas is **SVG-based**. `Canvas.tsx` renders an SVG element with a nested `<g>` transform for pan/zoom. Each canvas object is rendered via `ObjectRenderer.tsx`, which delegates to shape-specific components in `src/components/shapes/` (RectangleShape, DiamondShape, EllipseShape, ArrowShape, LineShape, TextShape, GroupShape). Resize handles and interaction are handled with `@use-gesture/react`.

### State Management (Zustand Slices)

The global store (`src/store/useWhiteboard.ts`) combines five slices into a single Zustand store with `persist` middleware (localStorage key: `"progressivedraw"`):

- **ObjectSlice** (`objectSlice.ts`) — `Record<string, CanvasObject>` for all canvas objects. CRUD, grouping/ungrouping, move operations, connection management.
- **UiSlice** (`uiSlice.ts`) — Active tool, selection state (`selectedObjectIds[]`, `editingObjectId`), viewport (zoom/pan), mode (`'edit'` | `'present'`), `ctrlPressed`, `isPanning`.
- **FrameSlice** (`frameSlice.ts`) — `currentFrame` for progressive disclosure timeline.
- **HistorySlice** (`historySlice.ts`) — Undo/redo with `past[]`/`future[]` stacks.
- **ClipboardSlice** (`clipboardSlice.ts`) — Copy/paste/duplicate with deep cloning and ID/connection remapping.

Persistence excludes transient state (selection, editing, clipboard).

### Event Handling (Hooks)

Three hooks in `src/hooks/canvas/` manage all canvas interaction:

- `useCanvasEvents` — Global keyboard events (Ctrl key tracking), gesture prevention.
- `useCanvasGestures` — Drawing, drag-selection, panning (Ctrl+drag), object dragging.
- `useCanvasShortcuts` — Keyboard shortcuts (Escape, Delete, Ctrl+Z/Y, Ctrl+C/V/D, Ctrl+G).

### Data Model

`CanvasObject` (defined in `src/types.ts`) has: `id`, `type` (rectangle|diamond|ellipse|arrow|line|text|group), `geometry` (x, y, width, height, optional `points[]` for arrows/lines), `style` (stroke, fill, fontSize), `appearFrame`, optional `disappearFrame`, optional `parentId`/`children` for groups, and optional `startConnection`/`endConnection` with cardinal anchors (n/s/e/w) for arrows/lines.

### UI Structure

- `App.tsx` wraps everything in `ErrorBoundary`
- `Canvas.tsx` — SVG drawing surface
- `UIOverlay.tsx` — Toolbar (tool selection), frame controls, property inspector

### Key Utilities

`src/utils/whiteboardUtils.ts` provides `calculateGroupBounds()`, `getRecursiveChildrenIds()`, and `getUpdatedConnections()` for maintaining group geometry and arrow/line endpoint consistency when objects move.

## Tech Stack

React 19, TypeScript (strict), Vite, Zustand, TailwindCSS v4, Framer Motion, @use-gesture/react, Lucide icons, nanoid.

## Style

- Dark theme (zinc-950 background, slate-50 text)
- Tailwind utility classes throughout; no CSS modules or styled-components
- React Compiler babel plugin enabled for optimization
