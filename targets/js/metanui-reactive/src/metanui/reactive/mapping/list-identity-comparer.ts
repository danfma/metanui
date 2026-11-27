import type { IReadOnlyList } from "metano-runtime/system/collections";
import { valueHashCode } from "metano-runtime";

export class ListIdentityComparer<TResult> {
  equals(x: IReadOnlyList<TResult> | null, y: IReadOnlyList<TResult> | null): boolean {
    return (x === y);
  }

  getHashCode(list: IReadOnlyList<TResult>): number {
    return valueHashCode(list);
  }
}
