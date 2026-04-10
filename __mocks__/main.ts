export const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
export const config = {
  obsidianVaultDirectory: './vault',
  docusaurusWebsiteDirectory: './website',
  obsidianAssetSubfolderName: 'assets',
  docusaurusAssetSubfolderName: 'assets',
  mainLanguage: 'en',
  convertedImageType: 'webp',
  convertedImageMaxWidth: '2500',
  debug: false,
  developer: false,
};
