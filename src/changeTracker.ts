import * as fs from 'fs';
import * as path from 'path';
import { logger } from 'main';
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
      filesToDelete.push({
        index: i,
        reason: 'it does not exist in sourceJson',
        pathKey: targetFile.pathSourceRelative,
      });
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
      await fs.promises.unlink(targetFile.pathTargetAbsolute);
      await deleteParentDirectories(targetFile.pathTargetAbsolute);
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
