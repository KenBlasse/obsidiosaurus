import { SourceFileInfo, Asset } from "./types";
import processMarkdown from "./markdownProcessor";
import { Notice } from "obsidian";
import { logger } from "main";
import { config } from "config";
import * as fs from "fs";
import * as path from "path";
import { getMainfolders, processSingleFolder } from './fileScanner';
import { getSourceFileInfo } from './fileInfoBuilder';
import { initializeJsonFile, writeJsonToFile, compareSource, getFilesToDelete, checkFilesExistence, deleteFiles, ensureDirectoryExistence } from './changeTracker';
import { getAssetsToProcess, copyAssetFilesToTarget, removeAssetReferences, deleteUnusedFiles, clearFileFromAssetJson } from './assetProcessor';

////////////////////////////////////////////////////////////////
// PREVIEW
////////////////////////////////////////////////////////////////

export interface ChangePreview {
	filesToProcess: number;
	filesToDelete: number;
}

export async function previewChanges(
	basePath: string,
	vaultPath: string
): Promise<ChangePreview> {
	const mainFolders = getMainfolders(vaultPath);
	mainFolders.forEach((folder) => processSingleFolder(folder, vaultPath));

	const allInfo = mainFolders.flatMap((folder) =>
		folder.files.map((file) =>
			getSourceFileInfo(basePath, folder, file, vaultPath)
		)
	);
	const allSourceFilesInfo = allInfo.filter((info) => info.type !== "assets");

	let targetJson: SourceFileInfo[] = await initializeJsonFile(
		path.join(basePath, "allFilesInfo.json")
	);
	targetJson = await checkFilesExistence(targetJson);

	const filesToDelete = getFilesToDelete(allSourceFilesInfo, targetJson);
	const filesToProcess = compareSource(allSourceFilesInfo, targetJson);

	return {
		filesToProcess: filesToProcess.length,
		filesToDelete: filesToDelete.length,
	};
}

////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////

export default async function obsidiosaurusProcess(
	basePath: string,
	vaultPath: string
): Promise<boolean> {
	// Docusaurus and Obsidian Vault paths
	const websitePath = path.join(basePath, config.docusaurusWebsiteDirectory);

	// Get the main folders of the vault e.g. docs, assets, ..
	const mainFolders = getMainfolders(vaultPath);
	mainFolders.forEach((folder) => processSingleFolder(folder, vaultPath));

	// Log folder structure when in debug mode
	if (config.debug) {
		logger.info(
			"📁 Folder structure with Files: %s",
			JSON.stringify(mainFolders)
		);
	}

	// Get all the file info from the main folders and separate assets from other files
	const allInfo = mainFolders.flatMap((folder) =>
		folder.files.map((file) =>
			getSourceFileInfo(basePath, folder, file, vaultPath)
		)
	);
	const allSourceFilesInfo: Partial<SourceFileInfo>[] = allInfo.filter(
		(info) => info.type !== "assets"
	);
	const allSourceAssetsInfo: Partial<SourceFileInfo>[] = allInfo.filter(
		(info) => info.type === "assets"
	);

	// Initialize or read the targetJson and assetJson
	let targetJson: SourceFileInfo[] = await initializeJsonFile(
		path.join(basePath, "allFilesInfo.json")
	);
	let assetJson: Asset[] = await initializeJsonFile<Asset>(
		path.join(basePath, "assetInfo.json")
	);

	// Verify existence of files in target.json and remove if not present
	targetJson = await checkFilesExistence(targetJson);

	// Check if source files are newer or missing in vault and prepare for deletion
	const filesToDelete = getFilesToDelete(
		allSourceFilesInfo,
		targetJson
	);

	// Process deletion of files and assets
	await deleteFiles(filesToDelete, targetJson, basePath);
	await removeAssetReferences(filesToDelete, assetJson, websitePath);

	// Write files and assets info to their respective JSON files
	targetJson = await writeJsonToFile(
		path.join(basePath, "allFilesInfo.json"),
		targetJson
	);
	await writeJsonToFile(
		path.join(basePath, "allSourceAssetsInfo.json"),
		allSourceAssetsInfo
	);

	// Compare source and target files to determine which ones to process
	const filesToProcess = compareSource(allSourceFilesInfo, targetJson);

	// Process markdown conversion if there are files to process
	if (filesToProcess.length > 0) {
		new Notice(`Processing ${filesToProcess.length} files`);

		// Get the indices of files to process and filter them from source files
		const filesToProcessIndices = filesToProcess.map((file) => file.index);
		const filesToMarkdownProcess = allSourceFilesInfo.filter((_, index) =>
			filesToProcessIndices.includes(index)
		);

		// Start the actual Markdown conversion and copy to Docusaurus folder
		await copyMarkdownFilesToTarget(
			filesToMarkdownProcess,
			basePath,
			targetJson,
			assetJson
		);

		// Write new allFilesInfo -> Used to compare for next run
		await writeJsonToFile(
			path.join(basePath, "allFilesInfo.json"),
			targetJson
		);
	} else {
		new Notice("Nothing to process");
	}

	// Find all assets that need to be processed and perform the conversion
	const assetsToProcess = getAssetsToProcess(assetJson, websitePath);
	new Notice(`Processing ${assetsToProcess.length} assets`);
	if (assetsToProcess.length > 0) {
		await copyAssetFilesToTarget(
			vaultPath,
			websitePath,
			assetJson,
			assetsToProcess
		);
	}

	// Delete unused markdown files from Docusaurus
	await deleteUnusedFiles(targetJson, websitePath);

	logger.info("Obsidiosaurus run successfully");
	new Notice("Obsidiosaurus run successfully");

	return true;
}

////////////////////////////////////////////////////////////////
// Markdown Conversion
////////////////////////////////////////////////////////////////

async function copyMarkdownFilesToTarget(
	files: Partial<SourceFileInfo>[],
	basePath: string,
	targetJson: Partial<SourceFileInfo>[],
	assetJson: Asset[]
) {
	const results: SourceFileInfo[] = [];

	const promises = files.map(async (file) => {
		const { pathTargetAbsolute, pathSourceAbsolute, pathSourceRelative } =
			file;
		// Ensure the directory exists

		if (pathTargetAbsolute && pathSourceAbsolute && pathSourceRelative) {
			await ensureDirectoryExistence(pathTargetAbsolute);

			const sourceContent = await fs.promises.readFile(
				pathSourceAbsolute,
				"utf-8"
			);
			// Clear stale asset references for this file before re-processing
			clearFileFromAssetJson(pathSourceRelative, assetJson);
			// Actual markdown conversion process
			const transformedContent = await processMarkdown(
				pathSourceRelative,
				sourceContent,
				assetJson
			);
			if (transformedContent) {
				await fs.promises.writeFile(
					pathTargetAbsolute,
					String(transformedContent)
				);
			}

			if (config.debug) {
				logger.info(
					`📤 Converted file from ${pathSourceAbsolute} to ${pathTargetAbsolute}`
				);
			}
		}

		results.push(file as SourceFileInfo);
	});

	// Wait for all copy operations to finish
	await Promise.all(promises);

	// Add results to targetJson
	targetJson.push(...results);

	await fs.promises.writeFile(
		path.join(basePath, "assetInfo.json"),
		JSON.stringify(assetJson, null, 2)
	);
}

