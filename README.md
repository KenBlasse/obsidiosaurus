<h1 align="center">
  <a href=""><img width="124" src="/logo.svg" alt="Obsidiosaurus"></a><br>
  Obsidiosaurus
</h1>

_<p align="center">Obsidian + Docusaurus = Where your Obsidian notes meet the web</p>_

<p align="center">
  <a href=""><img src="https://img.shields.io/badge/license-MIT-blue.svg?label=License&style=flat" /></a>
  <a href=""><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" /></a>
</p>

> **Community continuation** — the original author [Mat4m0](https://github.com/Mat4m0) is no longer maintaining this project and has handed it over to [KenBlasse](https://github.com/KenBlasse). This is now the official repository.

# 👋 Introduction

Obsidiosaurus is a converter for [Obsidian](https://obsidian.md/) markdown notes to the static site builder [Docusaurus](https://docusaurus.io/).

It allows for a better experience writing and maintaining markdown files, since both share a lot of common features.

# 📁 Vault Structure

Only folders named `docs`, `blog`, or `assets` (or containing those words) in your vault root are processed — everything else is ignored. This lets you keep personal notes alongside your public documentation.

Required directory layout:

```
parent/
  YourVault/          ← Obsidian Vault (any name)
    docs/             ← converted to Docusaurus docs
    assets/           ← images and files
  website/            ← Docusaurus instance (configurable in plugin settings)
```

The `docs/` folder supports subfolders, which become sidebar categories.

# 🔧 What's new in v1.0.0

Modernized codebase with Docusaurus v3 compatibility:

- **Docusaurus v3 support** — outputs `.mdx` files (required for admonitions with `future.v4` flag)
- **Admonition syntax updated** — `:::note[Title]` format, lowercase types
- **No system dependencies** — replaced GraphicsMagick (`gm`) with browser-native Canvas API; works in Electron without native addons
- **TypeScript 5.4** — upgraded from 4.7
- **Unit tests** — 33 tests across markdownProcessor, fileInfoBuilder, changeTracker, assetProcessor
- **Refactored architecture** — mainProcessor split into focused modules: `fileScanner`, `fileInfoBuilder`, `changeTracker`, `assetProcessor`
- **Bug fixes** — asset double-slash (#13/#18), ENOENT on stale assets (#14), orphaned files on rename (#16)

# 🚀 Installation

**Via BRAT** (recommended for non-store plugins):

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian Community Plugins
2. Open BRAT settings → "Add Beta plugin"
3. Enter: `KenBlasse/obsidiosaurus`
4. Enable the plugin in Obsidian settings

**Manual install:**

Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/KenBlasse/obsidiosaurus/releases) and place them in `.obsidian/plugins/obsidiosaurus/`.

# 👀 Documentation

Original documentation: [cimsta.github.io/obsidiosaurus-docs](https://cimsta.github.io/obsidiosaurus-docs/docs/main/Introduction)

# 📃 Features

## General

-   Documentation: ✅
-   Blog: ✅
-   Multiple Blogs: ✅
-   Localisation i18n: ✅
-   Multiple Sidebars: ✅
-   Versioning: ⛔ (complex)

## Standard Formatting

-   Links: ✅
-   Tables: ✅
-   Admonitions: ✅ (Docusaurus v3 syntax)
-   Quotes: ✅
-   iFrames: ✅
-   Codeblocks: ✅
-   Head Metadata: ✅
-   Checklists: ✅

## Assets

-   Images: ✅ (.png & .svg)
-   Image resize: ✅ (Canvas API, no system dependency)
-   Image converter: ✅ (.jpg, .png, .webp)
-   Themed Images: ✅ (light & dark mode)
-   Files: ✅ (.pdf, .docx, ..)

## Drawings & Diagrams

-   Excalidraw: ✅ (light & dark mode)
-   diagrams.net: ✅ (light only)
-   Math Equations: ✅
-   Mermaid: ✅
-   UML Diagrams: ❌ (not supported in Docusaurus)
-   D2 Diagrams: ❌ (not supported in Docusaurus)

## Advanced

-   Docusaurus Tabs: ❌ (not supported in Obsidian)
-   MDX Support: ❌ (not supported in Obsidian)

# 💭 Need help?

Open an [issue on GitHub](https://github.com/KenBlasse/obsidiosaurus/issues).

# ✍ Credits

Original author: [Mat4m0](https://github.com/Mat4m0) — Matthias
Current maintainer: [KenBlasse](https://github.com/KenBlasse)
