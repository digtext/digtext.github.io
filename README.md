# Dig.txt

A progressive reading interface where articles start short and readers expand only the parts that interest them.

**Live site**: https://digtext.github.io/

## How it works

Authors wrap optional detail in `>>double chevrons<<`. Readers see the shortest version first, then tap inline `+` buttons to dig deeper — only where they want to.

## Development

```sh
npm install
npm run dev       # Dev server on port 8080
npm run build     # Production build
npm run test      # Run tests
npm run lint      # ESLint check
```

## Tech stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via GitHub Actions.
