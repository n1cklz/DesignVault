# DesignVault

DesignVault is a local desktop image vault for designers. V1 focuses on importing images, browsing a visual grid, adding/removing tags, writing comments, opening a larger preview, and removing images.

## Run The App

```bash
npm install
npm run rebuild:sqlite
npm run dev
```

The app opens as an Electron desktop window. Vite also serves the renderer at `http://127.0.0.1:5173/` for layout preview.

## Open From The App Icon

Use `outputs/DesignVault.app` to open the real desktop app. This is the version that can import local images.

The browser preview at `http://127.0.0.1:5173/` is only for UI layout checking, so it cannot import images from your machine.

## What V1 Includes

- Local desktop app shell with Electron.
- React + TypeScript renderer.
- SQLite database stored under Electron's app data folder.
- Imported images copied into a local DesignVault image folder.
- Drag/drop import and file picker import.
- Search across filenames, tags, and comments.
- Tag add/remove, comment save, large preview, and image removal.
- Black-and-white Swiss-inspired UI.

## Current Limits

- No AI, Open WebUI, chat, embeddings, projects, or moodboards yet.
- The browser preview uses sample data because real file import/storage needs Electron.
- If SQLite fails after changing Electron versions, rerun `npm run rebuild:sqlite`.
