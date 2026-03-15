/**
 * Global type declarations for Window extensions (Electron preload, index.html).
 * These are injected at runtime and not available in test mode.
 */
interface ElectronAPI {
  openFileDialog: () => Promise<string>;
  saveFileDialog: (defaultName: string) => Promise<string>;
  importCSVDialog: () => Promise<string>;
  exportCSVDialog: (defaultName: string) => Promise<string>;
  updateMenuState: (state: Record<string, unknown>) => void;
  addRecentFile: (filePath: string) => Promise<void>;
  getRecentFiles: () => Promise<string[]>;
  removeRecentFile?: (filePath: string) => Promise<void>;
  getSettings: () => Promise<Record<string, unknown>>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  syncFormatMenu?: (styles: unknown) => void;
  syncRecentFilesMenu?: () => void;
  onMenuNew: (callback: () => void) => void;
  onMenuOpen: (callback: () => void) => void;
  onMenuSave: (callback: () => void) => void;
  onMenuSaveAs: (callback: () => void) => void;
  onMenuImportCSV: (callback: () => void) => void;
  onMenuExportCSV: (callback: () => void) => void;
  onMenuOpenRecent: (callback: (event: unknown, filePath: string) => void) => void;
  onMenuOpenCSV?: (callback: (filePath: string) => void) => void;
  onMenuOpenReadOnly?: (callback: () => void) => void;
  onOpenFileError?: (callback: (filePath: string) => void) => void;
  onMenuFormulaReference?: (callback: () => void) => void;
  onMenuUserGuide?: (callback: () => void) => void;
  onMenuUndo?: (callback: () => void) => void;
  onMenuRedo?: (callback: () => void) => void;
  onMenuCut: (callback: () => void) => void;
  onMenuCopy: (callback: () => void) => void;
  onMenuPaste: (callback: () => void) => void;
  onMenuSelectAll: (callback: () => void) => void;
  onMenuMergeCells?: (callback: () => void) => void;
  onMenuUnmergeCells?: (callback: () => void) => void;
  onMenuStyleTitle?: (callback: () => void) => void;
  onMenuStyleHeader?: (callback: () => void) => void;
  onMenuStyleTotal?: (callback: () => void) => void;
  onMenuApplyStyle?: (callback: (styleId: number) => void) => void;
  onMenuClearFormatting?: (callback: () => void) => void;
  onMenuFormatCleanup?: (callback: () => void) => void;
  onMenuManageStyles?: (callback: () => void) => void;
  onMenuInsertRow?: (callback: () => void) => void;
  onMenuInsertColumn?: (callback: () => void) => void;
  onMenuDeleteRow?: (callback: () => void) => void;
  onMenuDeleteColumn?: (callback: () => void) => void;
  onMenuAlignLeft?: (callback: () => void) => void;
  onMenuAlignCenter?: (callback: () => void) => void;
  onMenuAlignRight?: (callback: () => void) => void;
  onMenuToggleRTL?: (callback: (event: unknown, checked: boolean) => void) => void;
  onThemeChanged?: (callback: (theme: string) => void) => void;
  getUserGuideContent: () => Promise<string>;
}

declare global {
  interface Window {
    __DEBUG__?: boolean;
    __GOSHEET_TOKEN__?: string;
    electronAPI?: ElectronAPI;
  }
}

export {};
