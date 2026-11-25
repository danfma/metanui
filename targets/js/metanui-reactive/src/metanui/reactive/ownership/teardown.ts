import { toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import type { CleanupEntry } from "./cleanup-entry.js";

export class Teardown {
  static depth: number = 0;
  private static _firstError: Exception | null = null;

  constructor() { }

  static run(entry: CleanupEntry | null): void {
    Teardown.depth = (Teardown.depth + 1) | 0;
    while (!(entry == null)) {
      Teardown.runOne(entry.cleanup);
      entry = entry.next;
    }
    Teardown.depth = (Teardown.depth - 1) | 0;
  }

  static rethrowFirstError(): void {
    const error = Teardown._firstError;

    if (error == null) {
      return;
    }

    Teardown._firstError = null;
    throw error;
  }

  private static runOne(cleanup: () => void): void {
    try {
      cleanup();
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;
      Teardown._firstError ??= error;
    }
  }
}
