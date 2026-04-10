export class Plugin {
  app: any;
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  addRibbonIcon = jest.fn().mockReturnValue({ addClass: jest.fn() });
  addSettingTab = jest.fn();
}

export class PluginSettingTab {
  constructor(public app: any, public plugin: any) {}
}

export class Setting {
  constructor(public containerEl: any) {}
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  addDropdown = jest.fn().mockReturnThis();
}

export class Notice {
  constructor(message: string) {}
}

export class FileSystemAdapter {
  getBasePath = jest.fn().mockReturnValue('/mock/vault');
}

export const App = jest.fn();
