export class CleanupEntry {
  readonly cleanup: () => void;
  readonly next: CleanupEntry | null;

  constructor(cleanup: () => void, next: CleanupEntry | null) {
    this.cleanup = cleanup;
    this.next = next;
  }
}
