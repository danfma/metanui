import { defaultEqualityComparerFor } from "metano-runtime";

export class SplitBinding<T> {
  declare private _hasWritten: boolean;
  declare private readonly _write: (obj: T) => void;

  constructor(write: (obj: T) => void) {
    this._hasWritten = false;
    this._write = write;
  }

  /** @internal */
  apply(value: T, previous: T): void {
    if (this._hasWritten && defaultEqualityComparerFor().equals(value, previous)) {
      return;
    }

    this._hasWritten = true;
    this._write(value);
  }
}
