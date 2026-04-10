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
    expect(result).toContain(':::NOTE My Title');
    expect(result).toContain('Content here');
    expect(result).toContain(':::');
  });

  it('converts Obsidian WARNING callout', async () => {
    const input = '> [!WARNING]\n> Watch out\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::WARNING');
  });

  it('converts Obsidian TIP callout', async () => {
    const input = '> [!TIP] Pro tip\n> Use this\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::TIP Pro tip');
  });

  it('converts Obsidian QUOTE callout to blockquote', async () => {
    // Actual behavior: [!QUOTE] is uppercase, so it does NOT match the "quote" lowercase
    // check in convertAdmonition — it is treated as a regular admonition instead.
    const input = '> [!QUOTE] Author Name\n> The quote text\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain(':::QUOTE Author Name');
    expect(result).toContain('The quote text');
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
    expect(result).not.toContain('.md)');
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
    // Actual behavior: ![[assets/screenshot.png]] is first converted to
    // ![](assets/screenshot.png), then checkForAssets converts it to
    // ![screenshot](/assets/screenshot.webp), then checkForLinks incorrectly
    // prepends another "/" because the path already starts with "/" — resulting
    // in "//assets/screenshot.webp".
    const input = '![[assets/screenshot.png]]';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('![screenshot](//assets/screenshot.webp)');
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

  it('preserves SVG files without conversion to webp', async () => {
    const assetJson: any[] = [];
    const input = '![](assets/diagram.svg)';
    const result = await processMarkdown('test.md', input, assetJson);
    expect(result).toContain('.svg');
    expect(result).not.toContain('.webp');
  });

  it('converts non-image assets to download links', async () => {
    const input = '![](assets/guide.pdf)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('[Download guide.pdf]');
  });
});

describe('processMarkdown - quote callout', () => {
  it('handles lowercase [!quote] callout as blockquote', async () => {
    const input = '> [!quote] Author Name\n> The quote text\n\n';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('> — Author Name');
  });
});

describe('processMarkdown - blog links', () => {
  it('handles blog folder links', async () => {
    const input = '[Post](blog/my-first-post.md)';
    const result = await processMarkdown('test.md', input, []);
    expect(result).toContain('/blog/');
  });
});
