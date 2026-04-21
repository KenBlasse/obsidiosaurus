import { App, Modal, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from 'obsidian';
import obsidiosaurusProcess, { previewChanges, ChangePreview } from 'src/mainProcessor'
import { Config } from 'src/types'
import path from 'path';
import { setSettings } from 'config';

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

		const ribbonIconEl = this.addRibbonIcon('file-up', 'Obsidiosaurus', async (evt: MouseEvent) => {
			try {
				if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return;
				const vaultPath = this.app.vault.adapter.getBasePath();
				const basePath = path.dirname(vaultPath);

				const preview = await previewChanges(basePath, vaultPath);

				new ConfirmModal(this.app, preview, async () => {
					try {
						logger.info("🚀 Obsidiosaurus started");
						new Notice("🚀 Obsidiosaurus started");
						await obsidiosaurusProcess(basePath, vaultPath);
					} catch (error) {
						if (this.settings.debug) {
							const errorMessage = `❌ Obsidiosaurus crashed in function with the following error:\n${error.stack}`;
							logger.error(errorMessage);
							new Notice(`❌ Obsidiosaurus crashed. \n${errorMessage}`);
						} else {
							logger.error(`❌ Obsidiosaurus crashed with error message: \n${error} `);
							new Notice("❌ Obsidiosaurus crashed. \n Check log files for more info");
						}
					}
				}).open();
			} catch (error) {
				logger.error(`❌ Obsidiosaurus preview failed: \n${error}`);
				new Notice("❌ Could not calculate changes. Check log files for more info");
			}
		});

		ribbonIconEl.addClass('my-plugin-ribbon-class');

		this.addSettingTab(new SettingTab(this.app, this));

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

		new Setting(containerEl).setName('Dev options').setHeading();

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
	private onConfirm: () => void;

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
				this.onConfirm();
			}
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

