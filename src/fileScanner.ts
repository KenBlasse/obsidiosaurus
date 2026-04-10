import * as fs from 'fs';
import * as path from 'path';
import { config } from 'config';
import { logger } from 'main';
import { MainFolder } from './types';

export function getMainfolders(folderPath: string): MainFolder[] {
  const folders: MainFolder[] = [];
  const absoluteFolderPath = path.resolve(folderPath);

  if (config.debug) {
    logger.info('📁 Processing path: %s', absoluteFolderPath);
  }

  const objects = fs.readdirSync(absoluteFolderPath);

  if (config.debug) {
    logger.info('📂 Found files: %o', objects);
  }

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

      if (config.debug) {
        logger.info('🔍 File: %s, Type: %s', object, type);
      }
    }
  });

  if (config.debug) {
    logger.info('📤 Returning folders: %o', folders);
  }

  return folders;
}

export function searchFilesInFolder(directory: string): string[] {
  let results: string[] = [];
  const skipFiles = '.DS_Store';
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    if (skipFiles.includes(file)) {
      if (config.debug) {
        logger.info(`⏭️ Skipped ${file}`);
      }
      return;
    }

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
  const files = searchFilesInFolder(dirPath);
  folder.files = files;

  if (config.debug) {
    logger.info(
      '📄 Vault Files for %s: %s',
      folder.name,
      JSON.stringify(files)
    );
  }
}
