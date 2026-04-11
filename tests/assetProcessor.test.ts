import { clearFileFromAssetJson } from '../src/assetProcessor';
import { Asset } from '../src/types';

function makeAsset(fileName: string, inDocuments: string[]): Asset {
  return {
    fileName,
    originalFileName: `${fileName}.png`,
    fileExtension: 'png',
    dateModified: new Date().toISOString(),
    sourcePathRelative: `assets/${fileName}.png`,
    sizes: [{ size: 'standard', inDocuments: [...inDocuments], newName: [`${fileName}.webp`] }],
  };
}

describe('clearFileFromAssetJson', () => {
  it('removes file from inDocuments', () => {
    const assetJson: Asset[] = [makeAsset('photo', ['docs/a.md', 'docs/b.md'])];
    clearFileFromAssetJson('docs/a.md', assetJson);
    expect(assetJson[0].sizes[0].inDocuments).toEqual(['docs/b.md']);
  });

  it('removes size entry when inDocuments becomes empty', () => {
    const asset = makeAsset('photo', ['docs/a.md']);
    asset.sizes.push({ size: '800', inDocuments: ['docs/b.md'], newName: ['photo_800.webp'] });
    const assetJson: Asset[] = [asset];
    clearFileFromAssetJson('docs/a.md', assetJson);
    expect(assetJson[0].sizes).toHaveLength(1);
    expect(assetJson[0].sizes[0].size).toBe('800');
  });

  it('removes asset entry when sizes becomes empty', () => {
    const assetJson: Asset[] = [makeAsset('photo', ['docs/a.md'])];
    clearFileFromAssetJson('docs/a.md', assetJson);
    expect(assetJson).toHaveLength(0);
  });

  it('leaves unrelated assets untouched', () => {
    const assetJson: Asset[] = [
      makeAsset('photo', ['docs/a.md']),
      makeAsset('diagram', ['docs/b.md']),
    ];
    clearFileFromAssetJson('docs/a.md', assetJson);
    expect(assetJson).toHaveLength(1);
    expect(assetJson[0].fileName).toBe('diagram');
  });

  it('does nothing when file is not referenced', () => {
    const assetJson: Asset[] = [makeAsset('photo', ['docs/a.md'])];
    clearFileFromAssetJson('docs/nonexistent.md', assetJson);
    expect(assetJson).toHaveLength(1);
    expect(assetJson[0].sizes[0].inDocuments).toEqual(['docs/a.md']);
  });
});
