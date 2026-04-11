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
		logger.error('🚨 Required properties missing on sourceFileInfo');
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
	} else if (finalPathSourceRelative.endsWith('.md') && (type === 'docs' || type === 'blog' || type === 'blogMulti')) {
		finalPathSourceRelative = finalPathSourceRelative.replace(/\.md$/, '.mdx');
	}

	sourceFileInfo.pathTargetRelative = path.join(mainPath, finalPathSourceRelative);
	sourceFileInfo.pathTargetAbsolute = path.join(
		basePath,
		config.docusaurusWebsiteDirectory,
		sourceFileInfo.pathTargetRelative
	);

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
