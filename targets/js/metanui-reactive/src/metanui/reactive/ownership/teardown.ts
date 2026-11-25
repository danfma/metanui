import { toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import type { CleanupEntry } from "./cleanup-entry.js";

export class Teardown {
  static depth: number = 0;
  private static _firstError: Exception | null = null;

  constructor() { }

  static run(entry: CleanupEntry | null): void {
    Teardown.depth = (Teardown.depth + 1) | 0;
    const error = Teardown.runChain(entry);
    Teardown.depth = (Teardown.depth - 1) | 0;
    Teardown._firstError ??= error;
  }

  static runChain(entry: CleanupEntry | null): Exception | null {
    let firstError = null as Exception | null;
    while (!(entry == null)) {
      const error = Teardown.runOne(entry.cleanup);
      firstError ??= error;
      entry = entry.next;
    }

    return firstError;
  }

  static rethrowFirstError(): void {
    const error = Teardown._firstError;

    if (error == null) {
      return;
    }

    Teardown._firstError = null;
    throw error;
  }

  static discardFirstError(): void {
    Teardown._firstError = null;
  }

  private static runOne(cleanup: () => void): Exception | null {
    try {
      cleanup();

      return null;
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;

      return error;
    }
  }
}
