# Obsidiosaurus Modernization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize obsidiosaurus from a 2023 codebase to a maintainable, Docusaurus-v3-compatible Obsidian plugin with tests and no system-level dependencies.

**Architecture:** The plugin is restructured from one monolithic `mainProcessor.ts` (1021 lines) into focused modules: `fileScanner`, `fileInfoBuilder`, `changeTracker`, `assetProcessor`. The core markdown conversion in `markdownProcessor.ts` stays intact. The image processing dependency on ImageMagick/GraphicsMagick (`gm`) is replaced with `sharp` (pure JS, no system install required).

**Tech Stack:** TypeScript 5.x, esbuild (latest), obsidian API (latest), sharp (image processing), Jest + ts-jest (testing), Docusaurus v3 (target output format)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Keep | TypeScript interfaces |
| `src/fileScanner.ts` | Create | Vault directory scanning |
| `src/fileInfoBuilder.ts` | Create | SourceFileInfo construction, path mapping |
| `src/changeTracker.ts` | Create | JSON state file, diff logic, delete logic |
| `src/assetProcessor.ts` | Create | Image resize (sharp), asset copy, SVG/Excalidraw |
| `src/markdownProcessor.ts` | Keep | Markdown conversion (admonitions, links, assets) |
| `src/mainProcessor.ts` | Rewrite | Orchestration only (~60 lines) |
| `main.ts` | Keep | Obsidian plugin entry point |
| `config.ts` | Keep | Global config singleton |
| `tests/markdownProcessor.test.ts` | Create | Unit tests for markdown conversion |
| `tests/fileInfoBuilder.test.ts` | Create | Unit tests for path/filename logic |
| `tests/changeTracker.test.ts` | Create | Unit tests for diff logic |
| `jest.config.js` | Create | Jest configuration |
| `__mocks__/obsidian.ts` | Create | Obsidian API mock |

---

## Task 1: Update Dependencies and Fix Build

**Files:**
- Modify: `package.json`
- Create: `__mocks__/obsidian.ts`

- [ ] **Step 1: Update package.json devDependencies**

Replace the contents of `package.json` with:

```json
{
  "name": "obsidiosaurus",
  "version": "1.0.0",
  "description": "Obsidian to Docusaurus Converter Plugin",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "test": "jest"
  },
  "keywords": ["Docusaurus", "Converter", "Obsidian.md"],
  "author": "CIMSTA",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "builtin-modules": "3.3.0",
    "esbuild": "^0.21.0",
    "obsidian": "latest",
    "tslib": "^2.6.0",
    "typescript": "^5.4.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  },
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /var/mnt/Linux_NVME/obsidiosaurus
npm install
```

Expected: no fatal errors. Peer warnings are OK.

- [ ] **Step 3: Create Obsidian API mock**

Create `__mocks__/obsidian.ts`:

```typescript
export class Plugin {
  app: any;
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  addRibbonIcon = jest.fn().mockReturnValue({ addClass: jest.fn() });
  addSettingTab = jest.fn();
}

export class PluginSettingTab {
  constructor(public app: any, public plugin: any) {}
}

export class Setting {
  constructor(public containerEl: any) {}
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addDropdown = jest.fn().mockReturnThis();
}

export class Notice {
  constructor(message: string) {}
}

export class FileSystemAdapter {
  getBasePath = jest.fn().mockReturnValue('/mock/vault');
}

export const App = jest.fn();
```

- [ ] **Step 4: Attempt build**

```bash
npm run build 2>&1 | head -50
```

Note all TypeScript errors. Do NOT fix them yet — just record what fails.

- [ ] **Step 5: Fix TypeScript errors one by one**

Common issues after TS 4→5 upgrade:
- Implicit `any` on catch variables: change `catch (error)` to `catch (error: any)`
- Remove `@ts-ignore` where types now work correctly
- Update `noImplicitAny` violations

Apply fixes in `src/mainProcessor.ts` and `src/markdownProcessor.ts` as reported.

- [ ] **Step 6: Confirm build succeeds**

```bash
npm run build
```

Expected: exits 0, `main.js` is generated.

- [ ] **Step 7: Commit**

```bash
cd /var/mnt/Linux_NVME/obsidiosaurus
git add package.json package-lock.json __mocks__/obsidian.ts src/
git commit -m "chore: upgrade to TypeScript 5.x, esbuild 0.21, add sharp dependency"
```

---

## Task 2: Set Up Jest Testing Infrastructure

**Files:**
- Create: `jest.config.js`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create jest.config.js**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
    '^config$': '<rootDir>/config.ts',
    '^main$': '<rootDir>/__mocks__/main.ts',
  },
  testMatch: ['**/tests/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      },
    },
  },
};
```

- [ ] **Step 2: Create main mock (logger)**

Create `__mocks__/main.ts`:

```typescript
import pino from 'pino';
export const logger = pino({ level: 'silent' });
export const config = {
  obsidianVaultDirectory: './vault',
  docusaurusWebsiteDirectory: './website',
  obsidianAssetSubfolderName: 'assets',
  docusaurusAssetSubfolderName: 'assets',
  mainLanguage: 'en',
  convertedImageType: 'webp',
  convertedImageMaxWidth: '2500',
  debug: false,
  developer: false,
};
```

Wait — `pino` is not a runtime dependency after cleanup. Replace with:

```typescript
export const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
export const config = {
  obsidianVaultDirectory: './vault',
  docusaurusWebsiteDirectory: './website',
  obsidianAssetSubfolderName: 'assets',
  docusaurusAssetSubfolderName: 'assets',
  mainLanguage: 'en',
  convertedImageType: 'webp',
  convertedImageMaxWidth: '2500',
  debug: false,
  developer: false,
};
```

- [ ] **Step 3: Create tests directory**

```bash
mkdir -p /var/mnt/Linux_NVME/obsidiosaurus/tests
```

- [ ] **Step 4: Write smoke test to verify Jest works**

Create `tests/smoke.test.ts`:

```typescript
describe('jest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 1 test suite, 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add jest.config.js __mocks__/ tests/
git commit -m "test: add Jest infrastructure with Obsidian API mock"
```

---

## Task 3: Tests for markdownProcessor (Capture Current Behavior)

**Files:**
- Create: `tests/markdownProcessor.test.ts`

The goal is to lock in current behavior before refactoring. These tests will catch regressions.

- [ ] **Step 1: Write unit tests**

Create `tests/markdownProcessor.test.ts`:

```typescript
import processMarkdown from '../src/markdownProcessor';
import { setSettings } from '../config';

// Set up config before tests
beforeEach(() => {
  setSettings({
    obsidianVaultDirectory: './vault',
    docusaurusWebsiteDirectory: './website',
    obsidianAssetSubfolderName: 'assets',
    docusaurusAssetSubfolderName: 'assets',
    mainLanguage: 'en',
    convertedImageType: 'webp',
    convertedImageMaxWidth: '2500',
    debug: false,
    developer: false,
  });
});

describe('processMarkdown - admonitions', () => {
  it('converts Obsidian NOTE callout to Docusaurus admonition', async () => {
    const input = '> [!NOTE] My Title\n> Content here\n\nNext paragraph';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::note My Title');
    expect(result).toContain('Content here');
    expect(result).toContain(':::');
  });

  it('converts Obsidian WARNING callout', async () => {
    const input = '> [!WARNING]\n> Watch out\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::warning');
  });

  it('converts Obsidian TIP callout', async () => {
    const input = '> [!TIP] Pro tip\n> Use this\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::tip Pro tip');
  });

  it('converts Obsidian QUOTE callout to blockquote', async () => {
    const input = '> [!QUOTE] Author Name\n> The quote text\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('> — Author Name');
  });
});

describe('processMarkdown - links', () => {
  it('leaves external links unchanged', async () => {
    const input = '[Visit site](https://example.com)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('[Visit site](https://example.com)');
  });

  it('converts internal doc link to absolute path', async () => {
    const input = '[Guide](docs/getting-started.md)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('/docs/getting-started');
    expect(result).not.toContain('.md');
  });

  it('removes number prefix from path parts', async () => {
    const input = '[Guide](docs/01-intro/02-setup.md)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('/docs/intro/setup');
  });

  it('handles anchor links in internal links', async () => {
    const input = '[Section](docs/guide.md#my-section)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('#my-section');
  });
});

describe('processMarkdown - assets', () => {
  it('converts Obsidian asset embed to Markdown image', async () => {
    const input = '![[assets/screenshot.png]]';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('![](assets/screenshot.png)');
  });

  it('registers image in assetJson on first encounter', async () => {
    const assetJson: any[] = [];
    const input = '![](assets/photo.jpg)';
    await processMarkdown('test.md', input, assetJson);
    expect(assetJson.length).toBe(1);
    expect(assetJson[0].fileName).toBe('photo');
    expect(assetJson[0].fileExtension).toBe('jpg');
  });

  it('converts image to webp path', async () => {
    const assetJson: any[] = [];
    const input = '![](assets/photo.png)';
    const result = await processMarkdown('test.md', input, assetJson);
    expect(result).toContain('.webp');
  });

  it('handles sized image syntax', async () => {
    const assetJson: any[] = [];
    const input = '![|800](assets/photo.png)';
    await processMarkdown('test.md', input, assetJson);
    expect(assetJson[0].sizes[0].size).toBe('800');
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test tests/markdownProcessor.test.ts
```

Expected: most pass. Note any failures — they reveal bugs or misunderstandings of current behavior. Fix the test assertions (not the source) to match actual behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/markdownProcessor.test.ts
git commit -m "test: capture current markdownProcessor behavior"
```

---

## Task 4: Tests for File Info Logic (sanitizeFileName, getTargetPath)

**Files:**
- Create: `tests/fileInfoBuilder.test.ts`

These functions are pure and have no side effects — easy to test directly. We extract them first (in-place, not yet moving to a new file) to verify test setup works before the big refactor.

- [ ] **Step 1: Export sanitizeFileName and getTargetPath for testing**

In `src/mainProcessor.ts`, change the two functions from unexported to exported (add `export` keyword):

```typescript
// line ~395
export function sanitizeFileName(fileName: string): { ... }

// line ~439  
export function getTargetPath(sourceFileInfo: Partial<SourceFileInfo>, basePath: string): Partial<SourceFileInfo>
```

- [ ] **Step 2: Write tests**

Create `tests/fileInfoBuilder.test.ts`:

```typescript
import { sanitizeFileName } from '../src/mainProcessor';
import { setSettings } from '../config';

beforeEach(() => {
  setSettings({
    obsidianVaultDirectory: './vault',
    docusaurusWebsiteDirectory: './website',
    obsidianAssetSubfolderName: 'assets',
    docusaurusAssetSubfolderName: 'assets',
    mainLanguage: 'en',
    convertedImageType: 'webp',
    convertedImageMaxWidth: '2500',
    debug: false,
    developer: false,
  });
});

describe('sanitizeFileName', () => {
  it('returns clean name and extension for a simple file', () => {
    const result = sanitizeFileName('my-guide.md');
    expect(result.fileNameClean).toBe('my-guide');
    expect(result.fileExtension).toBe('.md');
    expect(result.language).toBe('en');
  });

  it('extracts language suffix from filename', () => {
    const result = sanitizeFileName('my-guide__de.md');
    expect(result.fileNameClean).toBe('my-guide');
    expect(result.language).toBe('de');
  });

  it('handles filenames without language suffix using mainLanguage', () => {
    const result = sanitizeFileName('readme.md');
    expect(result.language).toBe('en');
  });

  it('trims whitespace from clean name', () => {
    const result = sanitizeFileName('  spaced  .md');
    expect(result.fileNameClean).toBe('spaced');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test tests/fileInfoBuilder.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/mainProcessor.ts tests/fileInfoBuilder.test.ts
git commit -m "test: add sanitizeFileName unit tests, export for testing"
```

---

## Task 5: Replace GraphicsMagick with Sharp

**Files:**
- Modify: `src/mainProcessor.ts` (resizeImage, getImageWidth functions)
- Modify: `package.json` (remove gm and @types/gm)

Currently `gm` wraps ImageMagick and requires a system install. `sharp` is pure Node.js (libvips bundled).

- [ ] **Step 1: Remove gm from package.json devDependencies**

In `package.json`, remove these two lines:
```json
"@types/gm": "^1.25.1",
"gm": "^1.25.0",
```

Run:
```bash
npm install
```

- [ ] **Step 2: Replace gm initialization at bottom of mainProcessor.ts**

Find and delete this line (~line 1028):
```typescript
const gm = require("gm").subClass({ imageMagick: "7+" });
```

Add at the top of `src/mainProcessor.ts` with other imports:
```typescript
import sharp from 'sharp';
```

- [ ] **Step 3: Replace resizeImage function**

Find `async function resizeImage(...)` (~line 1030) and replace the entire function with:

```typescript
async function resizeImage(
  originalFilePath: string,
  newFilePath: string,
  size: string
): Promise<void> {
  const image = sharp(originalFilePath);
  const metadata = await image.metadata();
  const originalWidth = metadata.width ?? 2500;

  let width: number;
  let height: number | undefined;

  if (size === 'standard') {
    width = Math.min(originalWidth, parseInt(config.convertedImageMaxWidth));
    height = undefined; // auto
  } else {
    const dimensions = size.split('x');
    width = parseInt(dimensions[0]);
    height = dimensions.length > 1 ? parseInt(dimensions[1]) : undefined;
  }

  const resized = height
    ? image.resize(width, height, { fit: 'fill' })
    : image.resize(width, undefined, { fit: 'inside', withoutEnlargement: true });

  await resized.webp().toFile(newFilePath);
}
```

- [ ] **Step 4: Replace getImageWidth function**

Find `function getImageWidth(...)` (~line 1068) and replace with:

```typescript
async function getImageWidth(imagePath: string): Promise<number> {
  const metadata = await sharp(imagePath).metadata();
  return metadata.width ?? 2500;
}
```

Make it `async` — then update its caller in `resizeImage` (already `await`-ed above, so it's fine).

- [ ] **Step 5: Build to catch type errors**

```bash
npm run build 2>&1 | grep -E "error|Error"
```

Fix any reported errors.

- [ ] **Step 6: Run tests to ensure nothing broke**

```bash
npm test
```

Expected: all existing tests still pass (they don't test resizeImage directly).

- [ ] **Step 7: Commit**

```bash
git add src/mainProcessor.ts package.json package-lock.json
git commit -m "feat: replace GraphicsMagick/ImageMagick with sharp (no system dependency)"
```

---

## Task 6: Extract fileScanner.ts

**Files:**
- Create: `src/fileScanner.ts`
- Modify: `src/mainProcessor.ts`

Move folder/file discovery functions out of mainProcessor.

- [ ] **Step 1: Create src/fileScanner.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'config';
import { logger } from 'main';
import { MainFolder } from './types';

export function getMainfolders(folderPath: string): MainFolder[] {
  const folders: MainFolder[] = [];
  const absoluteFolderPath = path.resolve(folderPath);

  const objects = fs.readdirSync(absoluteFolderPath);

  objects.forEach((object) => {
    const filePath = path.join(absoluteFolderPath, object);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      let type: string | undefined;
      if (object.endsWith('__blog')) {
        type = 'blogMulti';
      } else if (object.includes('blog')) {
        type = 'blog';
      } else if (object.includes('docs')) {
        type = 'docs';
      } else if (object.includes(config.obsidianAssetSubfolderName)) {
        type = 'assets';
      } else {
        type = 'ignore';
      }

      if (type !== 'ignore' && type !== undefined) {
        folders.push({ name: object, type, files: [] });
      }
    }
  });

  return folders;
}

export function searchFilesInFolder(directory: string): string[] {
  let results: string[] = [];
  const skipFiles = '.DS_Store';
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    if (skipFiles.includes(file)) return;

    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(searchFilesInFolder(filePath));
    } else {
      results.push(filePath);
    }
  });

  return results;
}

export function processSingleFolder(folder: MainFolder, basePath: string): void {
  const dirPath = path.join(basePath, folder.name);
  folder.files = searchFilesInFolder(dirPath);
}
```

- [ ] **Step 2: Update mainProcessor.ts to import from fileScanner**

At the top of `src/mainProcessor.ts`, add:
```typescript
import { getMainfolders, processSingleFolder } from './fileScanner';
```

Remove the three function bodies (`getMainfolders`, `searchFilesInFolder`, `processSingleFolder`) from `mainProcessor.ts`.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | grep -E "error TS"
```

Fix any import errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/fileScanner.ts src/mainProcessor.ts
git commit -m "refactor: extract fileScanner.ts from mainProcessor"
```

---

## Task 7: Extract fileInfoBuilder.ts

**Files:**
- Create: `src/fileInfoBuilder.ts`
- Modify: `src/mainProcessor.ts`
- Modify: `tests/fileInfoBuilder.test.ts`

Move path computation and file info logic.

- [ ] **Step 1: Create src/fileInfoBuilder.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'config';
import { logger } from 'main';
import { MainFolder, SourceFileInfo } from './types';

export function sanitizeFileName(fileName: string): {
  fileNameClean: string;
  fileExtension: string;
  language: string;
} {
  const parsedPath = path.parse(fileName);
  const fileExtension = parsedPath.ext;
  let fileNameClean = parsedPath.name;

  const languageMatch = fileNameClean.match(/__([a-z]{2})$/i);
  let language: string;

  if (languageMatch) {
    fileNameClean = fileNameClean.split('__')[0];
    language = languageMatch[1];
  } else {
    if (!config?.mainLanguage) {
      throw new Error('Main language not defined in the configuration');
    }
    language = config.mainLanguage;
  }

  return { fileNameClean: fileNameClean.trim(), fileExtension, language };
}

export function getTargetPath(
  sourceFileInfo: Partial<SourceFileInfo>,
  basePath: string
): Partial<SourceFileInfo> {
  const { type, language, pathSourceRelative, mainFolder, parentFolder, fileExtension } = sourceFileInfo;

  if (!type || !language || !pathSourceRelative || !parentFolder || !fileExtension || !mainFolder) {
    throw new Error('Missing required properties on sourceFileInfo');
  }

  const isMainLanguage = language === config.mainLanguage;

  const mainPathDict: Record<string, string> = {
    docs: isMainLanguage ? '' : path.join('i18n', language, 'docusaurus-plugin-content-docs', 'current'),
    blog: isMainLanguage ? '' : path.join('i18n', language, 'docusaurus-plugin-content-blog'),
    blogMulti: isMainLanguage || !mainFolder ? '' : path.join('i18n', language, `docusaurus-plugin-content-blog-${mainFolder}`),
    assets: path.join('static', config.docusaurusAssetSubfolderName),
  };

  const mainPath = mainPathDict[type] ?? '';

  let finalPathSourceRelative = pathSourceRelative;

  if (parentFolder.endsWith('+')) {
    const pathParts = finalPathSourceRelative.split(path.sep);
    pathParts.pop();
    if (!isMainLanguage) pathParts.shift();

    if (pathParts.length > 0) {
      let lastPart = pathParts[pathParts.length - 1];
      if (lastPart.endsWith('+')) {
        lastPart = lastPart.slice(0, -1);
        pathParts[pathParts.length - 1] = lastPart;
      }
      finalPathSourceRelative = pathParts.join(path.sep) + fileExtension;
    }
  }

  finalPathSourceRelative = finalPathSourceRelative.replace(`__${language}`, '');

  if (finalPathSourceRelative.endsWith('.yml.md')) {
    finalPathSourceRelative = finalPathSourceRelative.replace('.yml.md', '.yml');
  }

  sourceFileInfo.pathTargetRelative = path.join(mainPath, finalPathSourceRelative);
  sourceFileInfo.pathTargetAbsolute = path.join(basePath, config.docusaurusWebsiteDirectory, sourceFileInfo.pathTargetRelative);

  return sourceFileInfo;
}

export function getSourceFileInfo(
  basePath: string,
  folder: MainFolder,
  filePath: string,
  vaultPath: string
): Partial<SourceFileInfo> {
  filePath = path.resolve(filePath);
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  const { fileNameClean, fileExtension, language } = sanitizeFileName(fileName);
  const pathSourceRelative = path.relative(vaultPath, filePath);

  let sourceFileInfo: Partial<SourceFileInfo> = {
    fileName,
    fileNameClean,
    fileExtension,
    language,
    mainFolder: folder.name,
    parentFolder: path.basename(path.dirname(filePath)),
    pathSourceAbsolute: filePath,
    pathSourceRelative,
    dateModified: stats.mtime,
    size: stats.size,
    type: folder.type,
  };

  return getTargetPath(sourceFileInfo, basePath);
}
```

- [ ] **Step 2: Update mainProcessor.ts imports**

Add to imports in `src/mainProcessor.ts`:
```typescript
import { getSourceFileInfo } from './fileInfoBuilder';
```

Remove `sanitizeFileName`, `getTargetPath`, `getSourceFileInfo` function bodies from `mainProcessor.ts`.

- [ ] **Step 3: Update test import**

In `tests/fileInfoBuilder.test.ts`, change the import:
```typescript
// Before:
import { sanitizeFileName } from '../src/mainProcessor';
// After:
import { sanitizeFileName } from '../src/fileInfoBuilder';
```

- [ ] **Step 4: Build and test**

```bash
npm run build 2>&1 | grep -E "error TS"
npm test
```

Expected: build clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fileInfoBuilder.ts src/mainProcessor.ts tests/fileInfoBuilder.test.ts
git commit -m "refactor: extract fileInfoBuilder.ts from mainProcessor"
```

---

## Task 8: Extract changeTracker.ts

**Files:**
- Create: `src/changeTracker.ts`
- Create: `tests/changeTracker.test.ts`
- Modify: `src/mainProcessor.ts`

Move state file I/O and diff logic.

- [ ] **Step 1: Write failing tests first**

Create `tests/changeTracker.test.ts`:

```typescript
import { compareSource, getFilesToDelete } from '../src/changeTracker';
import { SourceFileInfo, FilesToProcess } from '../src/types';

function makeFileInfo(pathSourceRelative: string, dateModified: Date = new Date('2024-01-01')): Partial<SourceFileInfo> {
  return { pathSourceRelative, dateModified } as Partial<SourceFileInfo>;
}

function makeTargetFileInfo(pathSourceRelative: string, dateModified: Date = new Date('2024-01-01')): SourceFileInfo {
  return { pathSourceRelative, dateModified } as SourceFileInfo;
}

describe('compareSource', () => {
  it('returns empty array when all source files exist in target', async () => {
    const source = [makeFileInfo('docs/guide.md')];
    const target = [makeTargetFileInfo('docs/guide.md')];
    const result = await compareSource(source, target);
    expect(result).toEqual([]);
  });

  it('returns file that exists in source but not in target', async () => {
    const source = [makeFileInfo('docs/new.md')];
    const target: SourceFileInfo[] = [];
    const result = await compareSource(source, target);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
    expect(result[0].reason).toContain('Does not exist');
  });

  it('does not flag files that exist in both', async () => {
    const source = [makeFileInfo('docs/a.md'), makeFileInfo('docs/b.md')];
    const target = [makeTargetFileInfo('docs/a.md'), makeTargetFileInfo('docs/b.md')];
    const result = await compareSource(source, target);
    expect(result).toEqual([]);
  });
});

describe('getFilesToDelete', () => {
  it('returns file that exists in target but not in source', async () => {
    const source: Partial<SourceFileInfo>[] = [];
    const target = [makeTargetFileInfo('docs/old.md')];
    const result = await getFilesToDelete(source, target);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('does not exist in sourceJson');
  });

  it('returns file when source is newer than target', async () => {
    const source = [makeFileInfo('docs/a.md', new Date('2025-01-02'))];
    const target = [makeTargetFileInfo('docs/a.md', new Date('2025-01-01'))];
    const result = await getFilesToDelete(source, target);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain('older');
  });

  it('does not flag file when target is newer or same as source', async () => {
    const source = [makeFileInfo('docs/a.md', new Date('2025-01-01'))];
    const target = [makeTargetFileInfo('docs/a.md', new Date('2025-01-02'))];
    const result = await getFilesToDelete(source, target);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/changeTracker.test.ts 2>&1 | head -20
```

Expected: FAIL — `changeTracker` module not found.

- [ ] **Step 3: Create src/changeTracker.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'main';
import { config } from 'config';
import { SourceFileInfo, FilesToProcess } from './types';

export async function initializeJsonFile(filePath: string, defaultContent: string = '[]'): Promise<any[]> {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.promises.writeFile(filePath, defaultContent);
    } else {
      console.error(`Error reading file: ${filePath}`, error);
    }
    return [];
  }
}

export async function writeJsonToFile(filePath: string, content: any): Promise<any> {
  await fs.promises.writeFile(filePath, JSON.stringify(content, null, 2));
  return JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
}

export async function compareSource(
  sourceJson: Partial<SourceFileInfo>[],
  targetJson: Partial<SourceFileInfo>[]
): Promise<FilesToProcess[]> {
  const filesToProcess: FilesToProcess[] = [];

  sourceJson.forEach((sourceFile, i) => {
    const matchingTargetFile = targetJson.find(
      (file) => file.pathSourceRelative === sourceFile.pathSourceRelative
    );
    if (!matchingTargetFile) {
      filesToProcess.push({ index: i, reason: 'Does not exist in targetJson' });
    }
  });

  return filesToProcess;
}

export async function getFilesToDelete(
  allSourceFilesInfo: Partial<SourceFileInfo>[],
  targetJson: SourceFileInfo[]
): Promise<FilesToProcess[]> {
  const filesToDelete: FilesToProcess[] = [];

  targetJson.forEach((targetFile, i) => {
    const matchingSourceFile = allSourceFilesInfo.find(
      (file) => file.pathSourceRelative === targetFile.pathSourceRelative
    );

    const targetDate = new Date(targetFile.dateModified);
    const sourceDate = matchingSourceFile?.dateModified ? new Date(matchingSourceFile.dateModified) : null;

    if (!matchingSourceFile) {
      filesToDelete.push({ index: i, reason: 'it does not exist in sourceJson', pathKey: targetFile.pathSourceRelative });
    } else if (sourceDate && targetDate.getTime() < sourceDate.getTime()) {
      filesToDelete.push({
        index: i,
        reason: `its last modification date ${targetDate} is older than the date in sourceJson ${sourceDate}`,
        pathKey: targetFile.pathSourceRelative,
      });
    }
  });

  return filesToDelete;
}

export async function checkFilesExistence(targetJson: SourceFileInfo[]): Promise<SourceFileInfo[]> {
  const existentFiles = await Promise.all(
    targetJson.map(async (fileInfo) => {
      try {
        await fs.promises.access(fileInfo.pathTargetAbsolute);
        const stats = await fs.promises.stat(fileInfo.pathTargetAbsolute);
        fileInfo.dateModifiedTarget = stats.mtime;
        fileInfo.sizeTarget = stats.size;
        return fileInfo;
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
        return null;
      }
    })
  );
  return existentFiles.filter((f): f is SourceFileInfo => f !== null);
}

export async function deleteFiles(
  filesToDelete: FilesToProcess[],
  targetJson: SourceFileInfo[],
  basePath: string
): Promise<void> {
  filesToDelete.sort((a, b) => b.index - a.index);

  for (const fileToDelete of filesToDelete) {
    const targetFile = targetJson[fileToDelete.index];
    try {
      await fs.promises.unlink(path.join(basePath, targetFile.pathTargetRelative));
      targetJson.splice(fileToDelete.index, 1);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error(`Failed to delete file ${targetFile.pathTargetRelative}: ${error}`);
        continue;
      }
      targetJson.splice(fileToDelete.index, 1);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test tests/changeTracker.test.ts
```

Expected: all pass.

- [ ] **Step 5: Update mainProcessor.ts imports**

```typescript
import { initializeJsonFile, writeJsonToFile, compareSource, getFilesToDelete, checkFilesExistence, deleteFiles } from './changeTracker';
```

Remove those function bodies from `mainProcessor.ts`.

- [ ] **Step 6: Build and run all tests**

```bash
npm run build && npm test
```

Expected: clean build, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/changeTracker.ts tests/changeTracker.test.ts src/mainProcessor.ts
git commit -m "refactor: extract changeTracker.ts, add unit tests for diff logic"
```

---

## Task 9: Extract assetProcessor.ts

**Files:**
- Create: `src/assetProcessor.ts`
- Modify: `src/mainProcessor.ts`

Move all asset-related functions (the sharp-based resize, copy logic, excalidraw handling, deleteUnusedFiles).

- [ ] **Step 1: Create src/assetProcessor.ts**

Move these functions from `mainProcessor.ts` into a new file, keeping their signatures identical:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import sharp from 'sharp';
import { config } from 'config';
import { logger } from 'main';
import { Asset, FilesToProcess, SourceFileInfo } from './types';

const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);

export async function getAssetsToProcess(
  assetJson: Asset[],
  websitePath: string
): Promise<{ assetIndex: number; sizeIndex: number; path: string }[]> {
  const documents = [];

  for (const [assetIndex, asset] of assetJson.entries()) {
    for (const [sizeIndex, size] of asset.sizes.entries()) {
      for (const name of size.newName) {
        documents.push({ assetIndex, sizeIndex, path: name });
      }
    }
  }

  return documents.filter((document) => {
    return !fs.existsSync(
      path.join(websitePath, 'static', config.docusaurusAssetSubfolderName, document.path)
    );
  });
}

export async function copyAssetFilesToTarget(
  vaultPath: string,
  websitePath: string,
  assetJson: Asset[],
  assetsToProcess: { assetIndex: number; sizeIndex: number; path: string }[]
): Promise<void> {
  const docusaurusAssetFolderPath = path.join(websitePath, 'static', config.docusaurusAssetSubfolderName);
  await mkdir(docusaurusAssetFolderPath, { recursive: true });

  for (const assetToProcess of assetsToProcess) {
    const asset = assetJson[assetToProcess.assetIndex];
    const size = asset.sizes[assetToProcess.sizeIndex];
    const originalFilePath = path
      .join(vaultPath, config.obsidianAssetSubfolderName, asset.originalFileName)
      .replace(/%20/g, ' ');

    for (const newName of size.newName) {
      const newFilePath = path.join(docusaurusAssetFolderPath, newName);

      if (['jpg', 'png', 'webp', 'jpeg', 'bmp'].includes(asset.fileExtension)) {
        try {
          await resizeImage(originalFilePath, newFilePath, size.size);
        } catch (error: any) {
          logger.error(`Failed to resize image: ${originalFilePath} → ${newFilePath}: ${error.message}`);
        }
      } else if (asset.fileExtension === 'gif') {
        await copyFile(originalFilePath, newFilePath);
      } else if (asset.fileExtension === 'svg') {
        await copyFile(originalFilePath, newFilePath);
      } else if (asset.fileExtension === 'excalidraw') {
        await copyExcalidraw(originalFilePath, newFilePath);
      } else {
        try {
          await copyFile(originalFilePath, newFilePath);
        } catch (error: any) {
          logger.error(`Failed to copy file: ${originalFilePath} → ${newFilePath}: ${error.message}`);
        }
      }
    }
  }
}

export async function removeAssetReferences(
  filesToDelete: FilesToProcess[],
  assetJson: Asset[],
  websitePath: string
): Promise<Asset[]> {
  for (const fileToDelete of filesToDelete) {
    if (!fileToDelete.pathKey) continue;

    for (let assetIndex = assetJson.length - 1; assetIndex >= 0; assetIndex--) {
      const asset = assetJson[assetIndex];

      for (let sizeIndex = asset.sizes.length - 1; sizeIndex >= 0; sizeIndex--) {
        const size = asset.sizes[sizeIndex];
        const docIndex = size.inDocuments.indexOf(fileToDelete.pathKey);

        if (docIndex !== -1) {
          size.inDocuments.splice(docIndex, 1);
          if (size.inDocuments.length === 0) {
            await removeAssetFromTarget(size.newName, config.docusaurusAssetSubfolderName, websitePath);
            asset.sizes.splice(sizeIndex, 1);
          }
        }
      }

      if (asset.sizes.length === 0) {
        assetJson.splice(assetIndex, 1);
      }
    }
  }

  return assetJson;
}

export function deleteUnusedFiles(json: SourceFileInfo[], websitePath: string): void {
  const targetDirectories = ['blog', 'i18n', 'docs'];
  const blogSuffix = '__blog';
  let filesFound: string[] = [];

  function exploreDirectory(directory: string) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        exploreDirectory(fullPath);
      } else if (entry.isFile()) {
        filesFound.push(fullPath);
      }
    }
  }

  targetDirectories.forEach((dir) => {
    const dirPath = path.join(websitePath, dir);
    if (fs.existsSync(dirPath)) exploreDirectory(dirPath);
  });

  const allDirectories = fs.readdirSync(websitePath, { withFileTypes: true });
  allDirectories
    .filter((dir) => dir.name.endsWith(blogSuffix))
    .forEach((dir) => exploreDirectory(path.join(websitePath, dir.name)));

  filesFound.forEach(async (file) => {
    if (!json.some((j) => j.pathTargetAbsolute === file)) {
      await fs.promises.unlink(file);
    }
  });
}

async function resizeImage(originalFilePath: string, newFilePath: string, size: string): Promise<void> {
  const image = sharp(originalFilePath);
  const metadata = await image.metadata();
  const originalWidth = metadata.width ?? 2500;

  let width: number;
  let height: number | undefined;

  if (size === 'standard') {
    width = Math.min(originalWidth, parseInt(config.convertedImageMaxWidth));
    height = undefined;
  } else {
    const dimensions = size.split('x');
    width = parseInt(dimensions[0]);
    height = dimensions.length > 1 ? parseInt(dimensions[1]) : undefined;
  }

  const resized = height
    ? image.resize(width, height, { fit: 'fill' })
    : image.resize(width, undefined, { fit: 'inside', withoutEnlargement: true });

  await resized.webp().toFile(newFilePath);
}

async function removeAssetFromTarget(
  assetToRemove: string[],
  docusaurusAssetSubfolderName: string,
  websitePath: string
): Promise<void> {
  for (const asset of assetToRemove) {
    const assetPath = path.join(websitePath, 'static', docusaurusAssetSubfolderName, asset);
    try {
      await fs.promises.unlink(assetPath);
    } catch (error: any) {
      logger.error(`Error removing asset: ${assetPath}`, error);
    }
  }
}

async function copyExcalidraw(originalFilePath: string, newFilePath: string): Promise<void> {
  const filePath = originalFilePath.replace('.md', '');
  const newDarkFilePath = newFilePath.replace('.light', '.dark');
  await copyFile(filePath + '.dark.svg', newDarkFilePath);
  await copyFile(filePath + '.light.svg', newFilePath);
}
```

- [ ] **Step 2: Update mainProcessor.ts**

Add imports:
```typescript
import { getAssetsToProcess, copyAssetFilesToTarget, removeAssetReferences, deleteUnusedFiles } from './assetProcessor';
```

Remove all moved function bodies from `mainProcessor.ts`. Also remove the `sharp` import from `mainProcessor.ts` (it moves to `assetProcessor.ts`).

- [ ] **Step 3: Build and test**

```bash
npm run build && npm test
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/assetProcessor.ts src/mainProcessor.ts
git commit -m "refactor: extract assetProcessor.ts, consolidate image/asset handling"
```

---

## Task 10: Slim mainProcessor.ts to Orchestration Only

**Files:**
- Modify: `src/mainProcessor.ts`

At this point mainProcessor should only have `obsidiosaurusProcess`, `copyMarkdownFilesToTarget`, `ensureDirectoryExistence`, and `deleteParentDirectories`. Move the last two utility functions out and reduce the file to pure orchestration.

- [ ] **Step 1: Move ensureDirectoryExistence and deleteParentDirectories to changeTracker.ts**

Add to `src/changeTracker.ts`:

```typescript
export async function ensureDirectoryExistence(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

export async function deleteParentDirectories(filepath: string): Promise<void> {
  let dirPath = path.dirname(filepath);
  while (dirPath !== path.dirname(dirPath)) {
    try {
      await fs.promises.rmdir(dirPath);
    } catch (error: any) {
      if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST' && error.code !== 'EPERM') {
        logger.error(`Failed to delete directory ${dirPath}: ${error}`);
      }
      return;
    }
    dirPath = path.dirname(dirPath);
  }
}
```

- [ ] **Step 2: Update mainProcessor.ts imports**

```typescript
import { ensureDirectoryExistence } from './changeTracker';
```

Remove the two function bodies from `mainProcessor.ts`.

- [ ] **Step 3: Remove augmentPathForMacOS**

The function `augmentPathForMacOS()` is macOS-only and adds Homebrew to PATH. On Linux this is a no-op. Remove the call and the function from `mainProcessor.ts`.

- [ ] **Step 4: Verify final mainProcessor.ts is clean**

At this point `src/mainProcessor.ts` should contain only:
- Imports
- `obsidiosaurusProcess()` (the main orchestration function, ~50 lines)
- `copyMarkdownFilesToTarget()` (reads file, calls processMarkdown, writes output)

```bash
wc -l src/mainProcessor.ts
```

Expected: under 120 lines.

- [ ] **Step 5: Build and test**

```bash
npm run build && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/mainProcessor.ts src/changeTracker.ts
git commit -m "refactor: mainProcessor reduced to orchestration only (~100 lines)"
```

---

## Task 11: Docusaurus v3 Compatibility Check

**Files:**
- No code changes (verification task)

- [ ] **Step 1: Set up a minimal Docusaurus v3 site**

```bash
cd /tmp
npx create-docusaurus@latest test-site classic --typescript
cd test-site
npm install
```

- [ ] **Step 2: Structure test vault**

```bash
mkdir -p /tmp/test-vault/docs /tmp/test-vault/assets
```

Create `/tmp/test-vault/docs/intro.md`:
```markdown
---
title: Introduction
---

# Introduction

> [!NOTE] Welcome
> This is a note

> [!WARNING]
> Watch out

Normal text with [internal link](docs/guide.md).

![](assets/test.png)
```

- [ ] **Step 3: Configure plugin to point to test setup**

In Obsidian (with plugin loaded), set:
- Vault: `/tmp/test-vault`
- Docusaurus: `/tmp/test-site`

- [ ] **Step 4: Run conversion**

Click the Obsidiosaurus ribbon icon. Check `/tmp/test-site/docs/` for the converted output.

- [ ] **Step 5: Verify MDX 2 compatibility**

Docusaurus v3 uses MDX 2. Known breaking changes:
- `{` `}` in text must be escaped as `\{` `\}` or wrapped in `{" "}`
- `<` `>` in text need escaping in some contexts

Start Docusaurus dev server:
```bash
cd /tmp/test-site && npm start
```

Check browser console for MDX parse errors. If found, add escaping logic to `markdownProcessor.ts`.

- [ ] **Step 6: Check admonition syntax**

Docusaurus v3 still supports `:::note` syntax — verify output renders correctly in browser.

- [ ] **Step 7: Document findings**

Update `docs/plans/2026-04-10-modernization.md` with any v3 issues found and fixes applied.

- [ ] **Step 8: Commit any compatibility fixes**

```bash
git add src/markdownProcessor.ts
git commit -m "fix: Docusaurus v3 / MDX 2 compatibility"
```

---

## Self-Review

### Spec Coverage
| Requirement | Task |
|-------------|------|
| Build works with TypeScript 5.x | Task 1 |
| No system-level ImageMagick/GraphicsMagick dependency | Task 5 |
| Tests for core logic | Tasks 3, 4, 8 |
| mainProcessor not monolithic | Tasks 6–10 |
| Docusaurus v3 verified | Task 11 |
| pino logger removed | Task 1 (not in new devDeps) |

### Remaining Known Issues
- `pino` logger: removed from dependencies in Task 1. The `main.ts` still uses it — replace with `console.log` wrapped calls or Obsidian's built-in Notice system. This is intentionally deferred as it requires changing the exported `logger` interface that all modules depend on.
- Windows path separator: `mainProcessor` uses `path.sep` which varies. Cross-platform testing is out of scope for this plan.
