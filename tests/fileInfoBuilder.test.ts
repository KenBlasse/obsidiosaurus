import { sanitizeFileName } from '../src/fileInfoBuilder';
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
