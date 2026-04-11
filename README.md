<h1 align="center">
  <a href=""><img width="124" src="/logo.svg" alt="Obsidiosaurus"></a><br>
  Obsidiosaurus
</h1>

_<p align="center">Obsidian + Docusaurus = Where your Obsidian notes meet the web</p>_

<p align="center">
  <a href=""><img src="https://img.shields.io/badge/license-MIT-blue.svg?label=License&style=flat" /></a>
  <a href=""><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" /></a>
</p>

> **This is a modernized fork** of [cimsta/obsidiosaurus](https://github.com/cimsta/obsidiosaurus) by [Mat4m0](https://github.com/Mat4m0).
> See [Changes from original](#-changes-from-original) below.

# 👋 Introduction

Obsidiosaurus is a converter for [Obsidian](https://obsidian.md/) markdown notes to the static site builder [Docusaurus](https://docusaurus.io/).

It allows for a better experience writing and maintaining markdown files, since both share a lot of common features.

# 🔧 Changes from original

This fork modernizes the codebase and adds Docusaurus v3 compatibility:

- **Docusaurus v3 support** — outputs `.mdx` files (required for admonitions with `future.v4` flag)
- **Admonition syntax updated** — `:::note[Title]` format, lowercase types
- **No system dependencies** — replaced GraphicsMagick (`gm`) with browser-native Canvas API; works in Electron without native addons
- **TypeScript 5.4** — upgraded from 4.7
- **Unit tests** — 33 tests across markdownProcessor, fileInfoBuilder, changeTracker, assetProcessor
- **Refactored architecture** — mainProcessor split into focused modules: `fileScanner`, `fileInfoBuilder`, `changeTracker`, `assetProcessor`
- **Bug fixes** — asset double-slash (#13/#18), ENOENT on stale assets (#14), orphaned files on rename (#16)

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

For the original plugin: [Obsidiosaurus Discord](https://discord.gg/SSGK5tuqJh)

# ✍ Credits

Original author: [Mat4m0](https://github.com/Mat4m0) — Matthias
