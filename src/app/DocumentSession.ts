export interface DocumentState {
  path: string | null;
  title: string;
  savedSnapshot: string;
  currentSnapshot: string;
}

export default class DocumentSession {
  private state: DocumentState;

  constructor(emptySnapshot: string) {
    this.state = {
      path: null,
      title: 'Unbenannt',
      savedSnapshot: emptySnapshot,
      currentSnapshot: emptySnapshot
    };
  }

  get path(): string | null {
    return this.state.path;
  }

  get title(): string {
    return this.state.title;
  }

  get dirty(): boolean {
    return this.state.currentSnapshot !== this.state.savedSnapshot;
  }

  update(snapshot: string): void {
    this.state.currentSnapshot = snapshot;
  }

  reset(snapshot: string, path: string | null, title: string): void {
    this.state = { path, title, savedSnapshot: snapshot, currentSnapshot: snapshot };
  }

  saved(snapshot: string, path: string): void {
    this.state.path = path;
    this.state.savedSnapshot = snapshot;
    this.state.currentSnapshot = snapshot;
  }
}
