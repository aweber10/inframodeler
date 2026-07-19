export type AppAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'example'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'fitViewport';

export interface PlatformAdapter {
  readonly isDesktop: boolean;
  pickOpenPath(): Promise<string | null>;
  pickSavePath(suggestedName: string): Promise<string | null>;
  readText(path: string): Promise<string>;
  writeText(path: string, contents: string): Promise<void>;
  setWindowTitle(title: string): Promise<void>;
  showError(title: string, message: string): Promise<void>;
  onAction(listener: (action: AppAction) => void): Promise<() => void>;
  onOpenPath(listener: (path: string) => void): Promise<() => void>;
  onCloseRequested(listener: () => Promise<boolean>): Promise<() => void>;
  closeWindow(): Promise<void>;
}
