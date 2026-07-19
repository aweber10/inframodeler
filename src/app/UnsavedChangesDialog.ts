export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export default class UnsavedChangesDialog {
  constructor(private readonly dialog: HTMLDialogElement) {}

  show(): Promise<UnsavedChoice> {
    return new Promise((resolve) => {
      const finish = (choice: UnsavedChoice) => {
        this.dialog.close();
        resolve(choice);
      };
      this.dialog.querySelector('[data-choice="save"]')?.addEventListener('click', () => finish('save'), { once: true });
      this.dialog.querySelector('[data-choice="discard"]')?.addEventListener('click', () => finish('discard'), { once: true });
      this.dialog.querySelector('[data-choice="cancel"]')?.addEventListener('click', () => finish('cancel'), { once: true });
      this.dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish('cancel');
      }, { once: true });
      this.dialog.showModal();
    });
  }
}
