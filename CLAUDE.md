# CLAUDE.md

This is the canonical project guide for AI coding agents in this repository.
`Codex.md` may exist as a thin compatibility pointer, but `CLAUDE.md` is the single maintained source of truth.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run preview      # Preview the production build
```

## Product Model

Dig.txt is a progressive reading app built with React, TypeScript, and Vite.
There are two main authoring and reading systems in the repo:

- `src/components/DigText.tsx` renders the inline `>>hidden<<` dig text format.
- `src/components/EditableLineView.tsx` powers the bullet / line-based reader-editor used in the `/p` prototypes.

The app is intentionally split between stable product pages and experimental prototype pages.

## Routes

Routes live in `src/App.tsx`.

- `/` is the live Home page connected to the public main nav.
- `/about` is the older About / prompt page.
- `/articles` is the article library.
- `/article/:articleId` is the article reader.
- `/reader` is the fullscreen DigText reader demo.
- `/p` is the prototype index.

### Prototype Routing Rule

For each prototype family, only one version should be treated as live.
The live version is the one connected to the real website and the main nav, not just the newest prototype in `/p`.

In practice:

- the live Home page is the component wired to `/`
- the live Articles page is the component wired to `/articles`
- versioned `/p/...` routes are archive / experiment routes, even if they render the same component

Current example:

- Home live route: `/`
- Live Home row in `/p`: `Home v2.6 (markdown)` and it should point to `/`
- Archived Home v2 route: `/p/home-v2`
- Archived Home experiments: versioned routes such as `/p/home-v2-1`, `/p/home-v2-4`, `/p/home-v2-5-text-area`
- Articles live route: `/articles`

When switching a page live:

- update the real public route first
- make sure the main nav points to that page
- only then update the live pill in `/p`

Do not point the live pill at a versioned `/p/...` URL if the public site is using a normal route like `/` or `/articles`.

## Current Home Prototype

The current live Home prototype is the new-qual variant.

- `src/pages/HomeV2_8_Minimal.tsx` is the archived minimal snapshot.
- `src/pages/HomeV2_9_NoChevrons.tsx` is the archived no-chevrons snapshot.
- `src/pages/HomeV2_10_EnterIcon.tsx` is the archived enter-icon snapshot.
- `src/pages/HomeV2_11_NewMinimalStyling.tsx` is the archived new-minimal-styling snapshot.
- `src/pages/HomeV2_11_NewQual.tsx` is the current live standalone new-qual snapshot (visual-quality pass on top of v2.10).
- `/p/home-v2` should continue to point to the older archived Home v2 page.

The textarea work is documented in `input-process.md`.
That file is the best short history of the decisions around:

- textarea instead of `contentEditable`
- tab-based internal indentation
- pasted-list normalization
- mirror-layer rendering for hanging indent and selection visuals

The live Home markdown prototype keeps that textarea input model.

- line-to-line dig text still comes from indentation
- inline dig text in the live Home preview now uses `((hidden text))` markers
- markdown in the Dig preview is supported within each line without changing the textarea editing behavior

## Dig / Editor Notes

### `DigText`

`src/components/DigText.tsx` is still the core inline dig-text parser.

- `>>text<<` marks an expandable section.
- Nesting is supported.
- The parser produces a segment tree and the renderer handles expand / collapse.
- `globalId` is intentionally reset per render for stable IDs within one render pass.

### `EditableLineView`

`EditableLineView` is used both as an editor and as a read-only collapsed reader.
When changing it, be careful not to break both modes at once.

- The editor behavior is tuned around keyboard-first editing and Safari compatibility.
- The read-only mode is what powers the Dig tab in the Home textarea prototype.

## Styling

- Tailwind CSS with class-based dark mode.
- Theme variables live in `src/index.css`.
- Main fonts currently include Newsreader, Inter, Source Serif 4, and Roboto Mono.

## Path Alias

`@/` maps to `src/` in both `vite.config.ts` and `tsconfig.json`.

## Working Rules For This Repo

- Live pill means "currently live on the public website / main nav", not "latest prototype".
- For Home, the live `/p` entry should currently be `Home v2.11 (new-qual)` mapped to `/`.
- `Home v2` is an archived prototype route and should stay on `/p/home-v2` unless explicitly promoted again.
- For Articles, the live `/p` entry should map to `/articles`.
- Prefer updating the public live route instead of inventing a new "live" versioned URL.
- For Home changes, scope edits to the newest live variant first, which is currently `src/pages/HomeV2_11_NewQual.tsx`.
- Avoid changing shared or archived Home files unless the change is intentionally meant to affect multiple versions.
- Archived Home pages must keep historical reader/icon behavior. They should import matching snapshots under `src/components/archive/`, not live shared reader components such as `EditableLineView`, `InlineDigMarkdown`, `DigIcons`, `DigTextReader`, or `BulletDigTextReader`.
- Before changing live reader/icon behavior, check archived Home imports. If an archived route still imports a live shared component, snapshot that component first or move the archived route to an existing snapshot.
- Home versions `v2.4` through `v2.11` are standalone files; do not reintroduce a shared Home wrapper for them.
- When creating a new Home version, duplicate the current live Home file into a new standalone page file first, then edit the new file.
- If creating a new Home version changes reader/editor/icon behavior, keep that behavior local to the new version or create a new archived component snapshot before later changing shared components.
- If you change the Home textarea input behavior, update `input-process.md`.
- Keep repo guidance synchronized here in `CLAUDE.md`; avoid duplicating long instructions in multiple files.
