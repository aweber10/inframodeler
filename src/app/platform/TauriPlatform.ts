import type { AppAction, PlatformAdapter } from './PlatformAdapter';

export default class TauriPlatform implements PlatformAdapter {
  readonly isDesktop = true;

  async pickOpenPath(): Promise<string | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    return open({ multiple: false, directory: false, filters: [fileFilter()] });
  }

  async pickSavePath(suggestedName: string): Promise<string | null> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    return save({ defaultPath: suggestedName, filters: [fileFilter()] });
  }

  async readText(path: string): Promise<string> {
    await this.allowPath(path);
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(path);
  }

  async writeText(path: string, contents: string): Promise<void> {
    await this.allowPath(path);
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, contents);
  }

  async setWindowTitle(title: string): Promise<void> {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title);
  }

  async showError(title: string, messageText: string): Promise<void> {
    const { message } = await import('@tauri-apps/plugin-dialog');
    await message(messageText, { title, kind: 'error' });
  }

  async onAction(listener: (action: AppAction) => void): Promise<() => void> {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<AppAction>('app-action', ({ payload }) => listener(payload));
  }

  async onOpenPath(listener: (path: string) => void): Promise<() => void> {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<string>('open-path', ({ payload }) => listener(payload));
    const { invoke } = await import('@tauri-apps/api/core');
    const initialPath = await invoke<string | null>('take_initial_path');
    if (initialPath) listener(initialPath);
    return unlisten;
  }

  async onCloseRequested(listener: () => Promise<boolean>): Promise<() => void> {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await listener();
    });
  }

  async closeWindow(): Promise<void> {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().destroy();
  }

  private async allowPath(path: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('allow_diagram_path', { path });
  }
}

function fileFilter() {
  return { name: 'InfraModeler-Diagramm', extensions: ['imod.json'] };
}
