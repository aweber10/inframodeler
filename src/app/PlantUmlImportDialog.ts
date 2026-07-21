import type { InfraType } from '../editor/infra/meta/types';
import type { PlantUmlWarning } from './import/plantuml/ast';

export default class PlantUmlImportDialog {
  constructor(private readonly dialog: HTMLDialogElement) {}

  show(warnings: PlantUmlWarning[], statistics: Partial<Record<InfraType, number>>): Promise<boolean> {
    const summary = this.dialog.querySelector<HTMLElement>('[data-import-summary]');
    const list = this.dialog.querySelector<HTMLUListElement>('[data-import-warnings]');
    if (summary) {
      const total = Object.values(statistics).reduce((sum, count) => sum + (count ?? 0), 0);
      summary.textContent = `${total} Elemente werden importiert. ${warnings.length} Hinweise wurden erkannt.`;
    }
    if (list) {
      list.replaceChildren(...warnings.map((warning) => {
        const item = document.createElement('li');
        item.textContent = `${warning.line ? `Zeile ${warning.line}: ` : ''}${warning.message}`;
        return item;
      }));
    }

    return new Promise((resolve) => {
      const finish = (accepted: boolean) => {
        this.dialog.close();
        resolve(accepted);
      };
      this.dialog.querySelector('[data-import="cancel"]')?.addEventListener('click', () => finish(false), { once: true });
      this.dialog.querySelector('[data-import="confirm"]')?.addEventListener('click', () => finish(true), { once: true });
      this.dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(false);
      }, { once: true });
      this.dialog.showModal();
    });
  }
}
