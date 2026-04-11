import { compareSource, getFilesToDelete, deleteFiles } from '../src/changeTracker';
import { SourceFileInfo, FilesToProcess } from '../src/types';
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

describe('deleteFiles', () => {
  it('uses pathTargetAbsolute for deletion, not basePath+pathTargetRelative', async () => {
    const tmpFile = require('os').tmpdir() + '/obsidiosaurus-test-delete.md';
    require('fs').writeFileSync(tmpFile, 'content');

    const targetJson: SourceFileInfo[] = [{
      pathTargetAbsolute: tmpFile,
      pathTargetRelative: 'docs/delete-me.md',
    } as SourceFileInfo];

    const filesToDelete = [{ index: 0, reason: 'renamed', pathKey: 'docs/delete-me.md' }];
    await deleteFiles(filesToDelete, targetJson, '/wrong/basepath');

    expect(require('fs').existsSync(tmpFile)).toBe(false);
    expect(targetJson).toHaveLength(0);
  });
});
