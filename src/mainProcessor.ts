import { MainFolder, SourceFileInfo, FilesToProcess, Asset } from "./types";
import processMarkdown from "./markdownProcessor";
import { Notice } from "obsidian";
import { logger } from "main";
import { config } from "config";
import * as fs from "fs";
import * as path from "path";
import util from "util";
import sharp from "sharp";
import { getMainfolders, processSingleFolder } from './fileScanner';
import { getSourceFileInfo } from './fileInfoBuilder';
import { initializeJsonFile, writeJsonToFile, compareSource, getFilesToDelete, checkFilesExistence, deleteFiles, ensureDirectoryExistence, deleteParentDirectories } from './changeTracker';

////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////

export default async function obsidiosaurusProcess(
	basePath: string
): Promise<boolean> {
	// Docusaurus and Obsidian Vault paths
	const websitePath = path.join(basePath, "website");
	const vaultPath = path.join(basePath, "vault");

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
	let assetJson = await initializeJsonFile(
		path.join(basePath, "assetInfo.json")
	);

	// Verify existence of files in target.json and remove if not present
	targetJson = await checkFilesExistence(targetJson);

	// Check if source files are newer or missing in vault and prepare for deletion
	const filesToDelete = await getFilesToDelete(
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
	const filesToProcess = await compareSource(allSourceFilesInfo, targetJson);

	// Process markdown conversion if there are files to process
	if (filesToProcess.length > 0) {
		new Notice(`⚙ Processing ${filesToProcess.length} Files`);

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
		new Notice(`💤 Nothing to process`);
	}

	augmentPathForMacOS();

	// Find all assets that need to be processed and perform the conversion
	const assetsToProcess = await getAssetsToProcess(assetJson, websitePath);
	new Notice(`⚙ Processing ${assetsToProcess.length} Assets`);
	if (assetsToProcess.length > 0) {
		await copyAssetFilesToTarget(
			vaultPath,
			websitePath,
			assetJson,
			assetsToProcess
		);
	}

	// Delete unused markdown files from Docusaurus
	deleteUnusedFiles(targetJson, websitePath);

	logger.info("✅ Obsidiosaurus run successfully");
	new Notice("✅ Obsidiosaurus run successfully");

	return true;
}

////////////////////////////////////////////////////////////////
// UTILS
////////////////////////////////////////////////////////////////

/**
 * Augments the Obsidian PATH environment variable for macOS to include the Homebrew path if it's not already included.
 */
function augmentPathForMacOS() {
	const os = require("os");

	if (config.debug) {
		logger.info(`🗺️ Current Obsidian ENV PATH: ${process.env.PATH}`);
	}

	if (os.platform() === "darwin") {
		// Add paths for homebrew on Apple Silicion and Intel
		const homebrewPath = "/opt/homebrew/bin:/usr/local/bin/brew";
		//@ts-ignore
		if (!process.env.PATH.includes(homebrewPath)) {
			process.env.PATH = homebrewPath + ":" + process.env.PATH;
			if (config.debug) {
				logger.info(`🗺️ New ENV PATH: ${process.env.PATH}`);
			}
		}
	}
}


////////////////////////////////////////////////////////////////
// FILES
////////////////////////////////////////////////////////////////

export function deleteUnusedFiles(json: SourceFileInfo[], websitePath: string) {
	const targetDirectories = ["blog", "i18n", "docs"];
	const blogSuffix = "__blog";

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

	// Scan each target directory
	targetDirectories.forEach((dir) => {
		const dirPath = path.join(websitePath, dir);
		if (fs.existsSync(dirPath)) {
			exploreDirectory(dirPath);
		}
	});

	// Go through other directories and look for blogSuffix folders
	const allDirectories = fs.readdirSync(websitePath, { withFileTypes: true });
	const otherDirectories = allDirectories.filter((dir) =>
		dir.name.endsWith(blogSuffix)
	);

	otherDirectories.forEach((dir) => {
		const dirPath = path.join(websitePath, dir.name);
		exploreDirectory(dirPath);
	});

	// Iterate through filesFound and check against the json
	filesFound.forEach(async (file) => {
		const fileIsUsed = json.some((j) => j.pathTargetAbsolute === file);

		// Delete the file if it's not used
		if (!fileIsUsed) {
			await fs.promises.unlink(file);
			console.log(`Deleted unused file: ${file}`);
		}
	});
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

////////////////////////////////////////////////////////////////
// Asset
////////////////////////////////////////////////////////////////

async function removeAssetReferences(
	filesToDelete: FilesToProcess[],
	assetJson: Asset[],
	websitePath: string
): Promise<Asset[]> {
	for (const fileToDelete of filesToDelete) {
		if (!fileToDelete.pathKey) {
			continue;
		}

		// Iterate backwards through each asset in the json
		for (
			let assetIndex = assetJson.length - 1;
			assetIndex >= 0;
			assetIndex--
		) {
			const asset = assetJson[assetIndex];

			// Iterate backwards through each size in the asset
			for (
				let sizeIndex = asset.sizes.length - 1;
				sizeIndex >= 0;
				sizeIndex--
			) {
				const size = asset.sizes[sizeIndex];

				// Find the index of the filePath in inDocuments array
				const docIndex = size.inDocuments.indexOf(fileToDelete.pathKey);

				// If the filePath is found in the inDocuments array
				if (docIndex !== -1) {
					// Remove the filePath from inDocuments array
					size.inDocuments.splice(docIndex, 1);
					if (config.debug) {
						logger.info(
							`🗑 Removed filePath from inDocuments: ${fileToDelete.pathKey}`
						);
					}
					// If inDocuments array is empty, remove the size entry
					if (size.inDocuments.length === 0) {
						const assetToRemove = size.newName;
						await removeAssetFromTarget(
							assetToRemove,
							config.docusaurusAssetSubfolderName,
							websitePath
						);

						asset.sizes.splice(sizeIndex, 1);
						if (config.debug) {
							logger.info(
								`🔥 Removed size from sizes: ${size.size}`
							);
						}
					}
				}
			}

			// If sizes array is empty, remove the asset entry
			if (asset.sizes.length === 0) {
				assetJson.splice(assetIndex, 1);
				if (config.debug) {
					logger.info(
						`💥 Removed asset from assetJson: ${asset.fileName}`
					);
				}
			}
		}
	}

	return assetJson;
}

async function removeAssetFromTarget(
	assetToRemove: string[],
	docusaurusAssetSubfolderName: string,
	websitePath: string
): Promise<void> {
	for (const asset of assetToRemove) {
		const assetPath = path.join(
			websitePath,
			"static",
			docusaurusAssetSubfolderName,
			asset
		);
		try {
			await fs.promises.unlink(assetPath);
			if (config.debug) {
				logger.info(`🗑 Removed asset: ${assetPath}`);
			}
		} catch (error) {
			if (config.debug) {
				logger.error(`❌ Error removing asset: ${assetPath}`, error);
			}
		}
	}
}

const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);

async function copyAssetFilesToTarget(
	vaultPathPath: string,
	websitePath: string,
	assetJson: Asset[],
	assetsToProcess: { assetIndex: number; sizeIndex: number; path: string }[]
): Promise<void> {
	const docusaurusAssetFolderPath = path.join(
		websitePath,
		"static",
		config.docusaurusAssetSubfolderName
	);
	await mkdir(docusaurusAssetFolderPath, { recursive: true });
	for (const assetToProcess of assetsToProcess) {
		// Use the indexes to find the original asset and size
		const asset = assetJson[assetToProcess.assetIndex];
		const size = asset.sizes[assetToProcess.sizeIndex];

		// Build the original file path
		const originalFilePath = path
			.join(
				vaultPathPath,
				config.obsidianAssetSubfolderName,
				asset.originalFileName
			)
			.replace(/%20/g, " ");

		for (const newName of size.newName) {
			const newFilePath = path.join(docusaurusAssetFolderPath, newName);

			// Check if it's an image
			if (
				["jpg", "png", "webp", "jpeg", "bmp", "gif"].includes(
					asset.fileExtension
				)
			) {
				try {
					// If size is standard, there is no resize needed for gifs, just increase file size
					if (
						size.size === "standard" &&
						asset.fileExtension === "gif"
					) {
						await fs.copyFileSync(originalFilePath, newFilePath);
						if (config.debug) {
							logger.info(
								`Image copied from ${originalFilePath} to ${newFilePath}`
							);
						}
					} else {
						await resizeImage(
							originalFilePath,
							newFilePath,
							size.size
						);
						if (config.debug) {
							logger.info(
								`Image resized and copied from ${originalFilePath} to ${newFilePath}`
							);
						}
					}
				} catch (error) {
					if (config.debug) {
						logger.info(
							`Failed to resize image and copy from ${originalFilePath} to ${newFilePath}: ${error.message}`
						);
					}
				}
			} else if (asset.fileExtension == "svg") {
				await copySVG(originalFilePath, newFilePath);
			} else if ([asset.fileExtension].includes("excalidraw")) {
				await copyExcalidraw(originalFilePath, newFilePath);
			} else {
				// Copy the file to the new location
				try {
					await copyFile(originalFilePath, newFilePath);
					if (config.debug) {
						logger.info(
							`File copied from ${originalFilePath} to ${newFilePath}`
						);
					}
				} catch (error) {
					if (config.debug) {
						logger.error(
							`Failed to copy file from ${originalFilePath} to ${newFilePath}: ${error.message}`
						);
					}
				}
			}
		}
	}
}

async function copySVG(originalFilePath: string, newFilePath: string) {
	await copyFile(originalFilePath, newFilePath);
}

async function copyExcalidraw(originalFilePath: string, newFilePath: string) {
	const filePath = originalFilePath.replace(".md", "");
	const newDarkFilePath = newFilePath.replace(".light", ".dark");
	const darkFilePath = filePath + ".dark.svg";
	await copyFile(darkFilePath, newDarkFilePath);

	const lightFilePath = filePath + ".light.svg";
	await copyFile(lightFilePath, newFilePath);
}

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

	if (size === "standard") {
		width = Math.min(originalWidth, parseInt(config.convertedImageMaxWidth));
		height = undefined;
	} else {
		const dimensions = size.split("x");
		width = parseInt(dimensions[0]);
		height = dimensions.length > 1 ? parseInt(dimensions[1]) : undefined;
	}

	const resized = height
		? image.resize(width, height, { fit: "fill" })
		: image.resize(width, undefined, { fit: "inside", withoutEnlargement: true });

	await resized.webp().toFile(newFilePath);
}

async function getImageWidth(imagePath: string): Promise<number> {
	const metadata = await sharp(imagePath).metadata();
	return metadata.width ?? 2500;
}

async function getAssetsToProcess(
	assetJson: Asset[],
	websitePath: string
): Promise<{ assetIndex: number; sizeIndex: number; path: string }[]> {
	const documents = [];

	// Loop through all assets
	for (const [assetIndex, asset] of assetJson.entries()) {
		// Loop through all sizes of each asset
		for (const [sizeIndex, size] of asset.sizes.entries()) {
			// Add all documents for each size to the array, along with the asset and size index
			for (const name of size.newName) {
				documents.push({ assetIndex, sizeIndex, path: name });
			}
		}
	}

	// Check if each document exists, if it does remove it from the array
	const assetsToProcess = documents.filter((document) => {
		const fileExists = fs.existsSync(
			path.join(
				websitePath,
				"static",
				config.docusaurusAssetSubfolderName,
				document.path
			)
		);

		if (!fileExists && config.debug) {
			logger.info(`File ${document.path} does not exist.`);
		}
		return !fileExists; // Only keep it in the array if the file does not exist
	});
	return assetsToProcess;
}
