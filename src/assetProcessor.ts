import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import util from "util";
import { config } from "config";
import { logger } from "main";
import { Asset, FilesToProcess, SourceFileInfo } from "./types";

const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);

////////////////////////////////////////////////////////////////
// Asset References
////////////////////////////////////////////////////////////////

export async function removeAssetReferences(
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

////////////////////////////////////////////////////////////////
// Asset Processing
////////////////////////////////////////////////////////////////

export async function getAssetsToProcess(
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

export async function copyAssetFilesToTarget(
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

////////////////////////////////////////////////////////////////
// Unused File Cleanup
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
// Image Helpers
////////////////////////////////////////////////////////////////

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
