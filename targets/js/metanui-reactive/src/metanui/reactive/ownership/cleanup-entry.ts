export class CleanupEntry {
  declare readonly cleanup: () => void;
  declare readonly next: CleanupEntry | null;

  constructor(cleanup: () => void, next: CleanupEntry | null) {
    this.cleanup = cleanup;
    this.next = next;
  }
}
