const STORAGE_KEY = 'inframodeler.recentFiles';
const MAX_FILES = 10;

export default class RecentFiles {
  get(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  add(path: string): void {
    this.set([path, ...this.get().filter((entry) => entry !== path)].slice(0, MAX_FILES));
  }

  remove(path: string): void {
    this.set(this.get().filter((entry) => entry !== path));
  }

  private set(paths: string[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  }
}
