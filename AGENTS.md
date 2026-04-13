# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Run Vitest (single run)
npm run test:watch   # Run Vitest in watch mode
npm run preview      # Preview production build
```

## Architecture

**Dig.txt** is a progressive/adaptive reading app built with React + TypeScript + Vite. The core idea: articles are written with expandable inline sections, letting readers choose their depth of engagement.

### Core Feature: DigText Component

`src/components/DigText.tsx` is the heart of the app. It implements a custom markup format:
- `>>text<<` marks an expandable section (nesting supported: `>>outer >>inner<< outer<<`)
- `parseDigText()` recursively parses the markup into a `Segment` tree (`visible` | `expandable`)
- `SegmentRenderer` renders the tree; expandable segments show a `+` toggle button inline
- Expanding reveals the hidden text highlighted with `bg-expanded-bg`
- "Expand all / Collapse all" controls at the top

**Important**: `globalId` is a module-level counter reset at the top of each `DigText` render — this is intentional for stable segment IDs within a single render.

### Routing & Pages

Defined in `src/App.tsx`:
- `/` → `pages/Home.tsx` — article library listing (most articles show "Coming soon")
- `/article/china-gay-rights` → `pages/Index.tsx` — article reader with sample content
- `*` → `pages/NotFound.tsx`

### Styling

- **Tailwind CSS** with class-based dark mode (`dark:` prefix)
- **Theme variables** in `src/index.css`: `--expanded-bg`, `--expand-button`, `--expand-button-hover` control the interactive elements
- **Fonts**: Newsreader (serif, article body) + Inter (sans, UI)
- **shadcn-ui** components live in `src/components/ui/` — 48 pre-built Radix UI components

### Path Alias

`@/` maps to `src/` throughout the codebase (configured in both `vite.config.ts` and `tsconfig.json`).

### Adding New Articles

1. Create a new page in `src/pages/` using the `DigText` component
2. Add a route in `src/App.tsx`
3. Update the article list in `src/pages/Home.tsx`
4. Write article content using `>>...<<` markup for expandable sections
