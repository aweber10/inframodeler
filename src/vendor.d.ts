declare module 'diagram-js-direct-editing' {
  import type { ModuleDeclaration } from 'didi';

  const module: ModuleDeclaration;
  export default module;
}

interface Window {
  __TAURI_INTERNALS__?: unknown;
}
