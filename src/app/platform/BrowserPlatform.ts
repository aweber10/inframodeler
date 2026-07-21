import type { PlatformAdapter } from './PlatformAdapter';

export default class BrowserPlatform implements PlatformAdapter {
  readonly isDesktop = false;
  private pendingFile: File | null = null;

  async pickOpenPath(): Promise<string | null> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.imod.json,.puml,.plantuml,.pu,application/json,text/plain';
    const file = await new Promise<File | null>((resolve) => {
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
      input.click();
    });
    this.pendingFile = file;
    return file?.name ?? null;
  }

  async pickSavePath(suggestedName: string): Promise<string> {
    return suggestedName;
  }

  async readText(): Promise<string> {
    if (!this.pendingFile) throw new Error('Keine Datei ausgewählt.');
    const contents = await this.pendingFile.text();
    this.pendingFile = null;
    return contents;
  }

  async writeText(path: string, contents: string): Promise<void> {
    const type = path.endsWith('.svg') ? 'image/svg+xml' : 'application/json';
    this.download(path, new Blob([contents], { type }));
  }

  async pickExportPath(suggestedName: string): Promise<string> {
    return suggestedName;
  }

  private download(path: string, blob: Blob): void {
    const anchor = document.createElement('a');
    anchor.download = path;
    anchor.href = URL.createObjectURL(blob);
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async setWindowTitle(title: string): Promise<void> {
    document.title = title;
  }

  async showError(title: string, message: string): Promise<void> {
    window.alert(`${title}\n\n${message}`);
  }

  async onAction(): Promise<() => void> {
    return () => undefined;
  }

  async onOpenPath(): Promise<() => void> {
    return () => undefined;
  }

  async onCloseRequested(): Promise<() => void> {
    return () => undefined;
  }

  async closeWindow(): Promise<void> {
    window.close();
  }

  async readRecovery(): Promise<string | null> {
    return localStorage.getItem('inframodeler.browserRecovery');
  }

  async writeRecovery(contents: string): Promise<void> {
    localStorage.setItem('inframodeler.browserRecovery', contents);
  }

  async removeRecovery(): Promise<void> {
    localStorage.removeItem('inframodeler.browserRecovery');
  }
}
