import { App, Modal, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from 'obsidian';
import obsidiosaurusProcess, { previewChanges, ChangePreview } from 'src/mainProcessor'
import { Config } from 'src/types'
import path from 'path';
import * as fs from 'fs';
import { setSettings } from 'config';

const STATUS_DIR = '.obsidiosaurus';
const STATUS_FILE = 'last-run.json';

type BuildStatus = 'running' | 'success' | 'error';

interface LastRunStatus {
	status: BuildStatus;
	startedAt: string;
	finishedAt?: string;
	filesToProcess?: number;
	filesToDelete?: number;
	error?: { message: string; stack?: string };
	version: string;
}

async function writeStatus(vaultPath: string, status: LastRunStatus): Promise<void> {
	try {
		const dir = path.join(vaultPath, STATUS_DIR);
		await fs.promises.mkdir(dir, { recursive: true });
		await fs.promises.writeFile(
			path.join(dir, STATUS_FILE),
			JSON.stringify(status, null, 2),
		);
	} catch (err) {
		logger.error(`Failed to write obsidiosaurus status file: ${err}`);
	}
}

export const logger = console;

export const config: Config = {
	obsidianVaultDirectory: "./vault",
	docusaurusWebsiteDirectory: "./website",
	obsidianAssetSubfolderName: "assets",
	docusaurusAssetSubfolderName: "assets",
	mainLanguage: "en",
	convertedImageType: "webp",
	convertedImageMaxWidth: "2500",
	debug: false,
	developer: false
}

export default class Obsidisaurus extends Plugin {
	settings: Config;

	async onload() {
		await this.loadSettings();
		if (this.settings.debug) {
			logger.info("🟢 Obsidiosaurus Plugin loaded");
		}

		const ribbonIconEl = this.addRibbonIcon('file-up', 'Obsidiosaurus', async () => {
			await this.runBuild({ skipConfirm: false });
		});

		ribbonIconEl.addClass('my-plugin-ribbon-class');

		this.addCommand({
			id: 'run',
			name: 'Run Obsidiosaurus',
			callback: async () => {
				await this.runBuild({ skipConfirm: true });
			},
		});

		this.addCommand({
			id: 'run-with-confirm',
			name: 'Run Obsidiosaurus (preview changes first)',
			callback: async () => {
				await this.runBuild({ skipConfirm: false });
			},
		});

		this.addSettingTab(new SettingTab(this.app, this));

	}

	private async runBuild({ skipConfirm }: { skipConfirm: boolean }): Promise<void> {
		try {
			if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return;
			const vaultPath = this.app.vault.adapter.getBasePath();
			const basePath = path.dirname(vaultPath);

			const executeBuild = async (preview?: ChangePreview) => {
				const startedAt = new Date().toISOString();
				await writeStatus(vaultPath, {
					status: 'running',
					startedAt,
					filesToProcess: preview?.filesToProcess,
					filesToDelete: preview?.filesToDelete,
					version: this.manifest.version,
				});
				try {
					logger.info("Obsidiosaurus started");
					new Notice("Obsidiosaurus started");
					await obsidiosaurusProcess(basePath, vaultPath);
					await writeStatus(vaultPath, {
						status: 'success',
						startedAt,
						finishedAt: new Date().toISOString(),
						filesToProcess: preview?.filesToProcess,
						filesToDelete: preview?.filesToDelete,
						version: this.manifest.version,
					});
				} catch (error) {
					if (this.settings.debug) {
						const errorMessage = `Obsidiosaurus crashed in function with the following error:\n${error.stack}`;
						logger.error(errorMessage);
						new Notice(`Obsidiosaurus crashed. ${errorMessage}`);
					} else {
						logger.error(`Obsidiosaurus crashed with error message: \n${error} `);
						new Notice("Obsidiosaurus crashed. Check log files for more info");
					}
					await writeStatus(vaultPath, {
						status: 'error',
						startedAt,
						finishedAt: new Date().toISOString(),
						filesToProcess: preview?.filesToProcess,
						filesToDelete: preview?.filesToDelete,
						error: { message: String(error?.message ?? error), stack: error?.stack },
						version: this.manifest.version,
					});
				}
			};

			const preview = await previewChanges(basePath, vaultPath);

			if (skipConfirm) {
				await executeBuild(preview);
				return;
			}

			new ConfirmModal(this.app, preview, () => executeBuild(preview)).open();
		} catch (error) {
			logger.error(`Obsidiosaurus preview failed: \n${error}`);
			new Notice("Could not calculate changes. Check log files for more info");
		}
	}

	onunload() {
		if (config.debug) {
			logger.info('⚪ Obsidiosaurus Plugin unloaded');
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, config, await this.loadData());
		setSettings(this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}


class SettingTab extends PluginSettingTab {
	plugin: Obsidisaurus;

	constructor(app: App, plugin: Obsidisaurus) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('Directories').setHeading();

		new Setting(containerEl)
			.setName('Docusaurus directory')
			.setDesc('Path to your Docusaurus instance')
			.addText(text => text
				.setPlaceholder('Enter paths')
				.setValue(this.plugin.settings.docusaurusWebsiteDirectory)
				.onChange(async (value) => {
					this.plugin.settings.docusaurusWebsiteDirectory = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Assets').setHeading();

		new Setting(containerEl)
			.setName('Obsidian asset folder')
			.setDesc('Name of the Obsidian asset folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.obsidianAssetSubfolderName)
				.onChange(async (value) => {
					this.plugin.settings.obsidianAssetSubfolderName = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Docusaurus asset folder')
			.setDesc('Name of the Docusaurus asset folder')
			.addText(text => text
				.setPlaceholder('Enter folders')
				.setValue(this.plugin.settings.docusaurusAssetSubfolderName)
				.onChange(async (value) => {
					this.plugin.settings.docusaurusAssetSubfolderName = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image type')
			.setDesc('Format in which to convert all images')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'webp': 'WebP',
				})
				.setValue(this.plugin.settings.convertedImageType)
				.onChange(async (value) => {
					this.plugin.settings.convertedImageType = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Image width')
			.setDesc('Set the max width for the images in [px]')
			.addText(number => number
				.setPlaceholder('2500')
				.setValue(this.plugin.settings.convertedImageMaxWidth)
				.onChange(async (value) => {
					this.plugin.settings.convertedImageMaxWidth = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Language').setHeading();

		new Setting(containerEl)
			.setName('Main language')
			.setDesc('Your main language code to publish')
			.addText(text => text
				.setPlaceholder('Enter language code')
				.setValue(this.plugin.settings.mainLanguage)
				.onChange(async (value) => {
					this.plugin.settings.mainLanguage = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Developer').setHeading();

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Better logging for debugging')
			.addToggle((value) => {
				value.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					void this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Developer mode')
			.setDesc('Only for plugin developers')
			.addToggle((value) => {
				value.setValue(this.plugin.settings.debug).onChange((value) => {
					this.plugin.settings.debug = value;
					void this.plugin.saveSettings();
				});
			});


	}
}


class ConfirmModal extends Modal {
	private preview: ChangePreview;
	private onConfirm: () => Promise<void>;

	constructor(app: App, preview: ChangePreview, onConfirm: () => Promise<void>) {
		super(app);
		this.preview = preview;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Run Obsidiosaurus?' });

		const { filesToProcess, filesToDelete } = this.preview;

		if (filesToProcess === 0 && filesToDelete === 0) {
			contentEl.createEl('p', { text: 'Nothing to do — all files are up to date.' });
		} else {
			const list = contentEl.createEl('ul');
			if (filesToProcess > 0)
				list.createEl('li', { text: `${filesToProcess} file${filesToProcess !== 1 ? 's' : ''} will be converted / updated` });
			if (filesToDelete > 0)
				list.createEl('li', { text: `${filesToDelete} file${filesToDelete !== 1 ? 's' : ''} will be deleted from website` });
		}

		const buttonRow = contentEl.createDiv({ cls: 'modal-button-container' });

		buttonRow.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
			this.close();
		});

		const confirmBtn = buttonRow.createEl('button', {
			text: filesToProcess === 0 && filesToDelete === 0 ? 'OK' : 'Run',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => {
			this.close();
			if (filesToProcess > 0 || filesToDelete > 0) {
				void this.onConfirm();
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

