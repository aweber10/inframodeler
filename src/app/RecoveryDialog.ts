export type RecoveryChoice = 'restore' | 'discard';

export default class RecoveryDialog {
  constructor(private readonly dialog: HTMLDialogElement) {}

  show(timestamp: string): Promise<RecoveryChoice> {
    const time = this.dialog.querySelector<HTMLElement>('[data-recovery-time]');
    if (time) time.textContent = new Date(timestamp).toLocaleString('de-DE');
    return new Promise((resolve) => {
      const finish = (choice: RecoveryChoice) => {
        this.dialog.close();
        resolve(choice);
      };
      this.dialog.querySelector('[data-recovery="discard"]')?.addEventListener('click', () => finish('discard'), { once: true });
      this.dialog.querySelector('[data-recovery="restore"]')?.addEventListener('click', () => finish('restore'), { once: true });
      this.dialog.showModal();
    });
  }
}
