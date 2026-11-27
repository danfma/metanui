import { Dictionary, List, throwModified, type IEqualityComparer, type IReadOnlyList } from "metano-runtime/system/collections";
import { arrayLength, defaultEqualityComparerFor, intDiv } from "metano-runtime";
import { Computed } from "../computed.js";
import { ScopeOwner } from "../ownership/scope-owner.js";
import { Tracking } from "../tracking.js";
import { ListIdentityComparer } from "./list-identity-comparer.js";

export class KeyedMap<T, TKey, TResult> {
  private static readonly noPosition: number = -1;
  declare private readonly _source: () => IReadOnlyList<T>;
  declare private readonly _key: (arg: T) => TKey;
  declare private readonly _map: (arg: T) => TResult;
  declare private readonly _listOwner: ScopeOwner;
  declare private readonly _mapped: Computed<IReadOnlyList<TResult>>;
  declare private readonly _nextPositions: Dictionary<TKey, number>;
  declare private _keys: List<TKey>;
  declare private _results: List<TResult>;
  declare private _owners: ScopeOwner[];
  declare private _previousPositions: number[];
  declare private _laterPositions: number[];

  constructor(source: () => IReadOnlyList<T>, key: (arg: T) => TKey, map: (arg: T) => TResult) {
    this._source = undefined!;
    this._key = undefined!;
    this._map = undefined!;
    this._listOwner = undefined!;
    this._mapped = undefined!;
    this._nextPositions = (new Dictionary<TKey, number>());
    this._keys = new List<TKey>();
    this._results = new List<TResult>();
    this._owners = [];
    this._previousPositions = [];
    this._laterPositions = [];
    this._source = source;
    this._key = key;
    this._map = map;
    this._listOwner = new ScopeOwner();
    this._mapped = new Computed(this.run.bind(this), KeyedMap.resultComparer());
  }

  /** @internal */
  read(): IReadOnlyList<TResult> {
    return this._mapped.value;
  }

  private run(): IReadOnlyList<TResult> {
    const items = this._source();
    const previousObserver = Tracking.activeObserver;
    Tracking.activeObserver = null;
    try {
      return this.reconcile(items);
    } finally {
      Tracking.activeObserver = previousObserver;

      if (this._listOwner.isDisposed) {
        this._listOwner.disposeOwned();
      }
    }
  }

  private reconcile(items: IReadOnlyList<T>): IReadOnlyList<TResult> {
    const start = this.commonPrefixLength(items);

    if (start === items.count && start === this._keys.count) {
      return this._results;
    }

    const keys = this.readKeys(items, start);
    const suffix = this.trimmableSuffixLength(keys, start);
    const newEnd = (keys.count - suffix) | 0;
    const oldEnd = (this._keys.count - suffix) | 0;
    this.ensureScratch((newEnd - start) | 0);
    const removed = this.pairKeptItems(keys, start, newEnd, oldEnd);
    const owners = new Array(arrayLength(keys.count)).fill(null);
    const results = this.buildResults(items, start, newEnd, owners);
    this._keys = keys;
    this._owners = owners;
    this._results = results;
    KeyedMap.disposeAll(removed);

    return results;
  }

  private commonPrefixLength(items: IReadOnlyList<T>): number {
    const limit = Math.min(items.count, this._keys.count);
    let start = 0;
    while (start < limit && KeyedMap.keysEqual(this._keys.get(start), this._key(items.get(start)))) {
      start = (start + 1) | 0;
    }

    return start;
  }

  private readKeys(items: IReadOnlyList<T>, start: number): List<TKey> {
    const keys = List.withCapacity<TKey>(items.count);
    for (let index = 0; index < start; index++) {
      keys.add(this._keys.get(index));
    }
    for (let index = start; index < items.count; index++) {
      keys.add(this._key(items.get(index)));
    }

    return keys;
  }

  private trimmableSuffixLength(keys: List<TKey>, start: number): number {
    const suffix = this.commonSuffixLength(keys, start);

    if (suffix === 0) {
      return 0;
    }

    const newEnd = (keys.count - suffix) | 0;
    const oldEnd = (this._keys.count - suffix) | 0;
    const windowLength = (newEnd - start + (oldEnd - start)) | 0;

    if (windowLength > intDiv(keys.count, suffix)) {
      return 0;
    }

    const sharesAKey = this.anyKeyOccursIn(keys, start, newEnd, keys, newEnd) || this.anyKeyOccursIn(this._keys, start, oldEnd, keys, newEnd);

    return sharesAKey ? 0 : suffix;
  }

  private commonSuffixLength(keys: List<TKey>, start: number): number {
    const limit = (Math.min(keys.count, this._keys.count) - start) | 0;
    let length = 0;
    while (length < limit && KeyedMap.keysEqual(this._keys.get((this._keys.count - 1 - length) | 0), keys.get((keys.count - 1 - length) | 0))) {
      length = (length + 1) | 0;
    }

    return length;
  }

  private anyKeyOccursIn(source: List<TKey>, from: number, to: number, suffix: List<TKey>, suffixStart: number): boolean {
    for (let index = from; index < to; index++) {
      for (let other = suffixStart; other < suffix.count; other++) {
        if (KeyedMap.keysEqual(source.get(index), suffix.get(other))) {
          return true;
        }
      }
    }

    return false;
  }

  private ensureScratch(length: number): void {
    if (this._previousPositions.length >= length) {
      return;
    }

    const capacity = Math.max(length, Math.imul(this._previousPositions.length, 2));
    this._previousPositions = new Array<number>(arrayLength(capacity)).fill(0);
    this._laterPositions = new Array<number>(arrayLength(capacity)).fill(0);
  }

  private pairKeptItems(keys: List<TKey>, start: number, newEnd: number, oldEnd: number): List<ScopeOwner> | null {
    for (let slot = 0; slot < ((newEnd - start) | 0); slot++) {
      this._previousPositions[slot] = KeyedMap.noPosition;
    }

    if (oldEnd === start) {
      return null;
    }

    try {
      this.indexWindow(keys, start, newEnd);

      return this.pairWithIndex(start, oldEnd);
    } finally {
      this._nextPositions.clear();
    }
  }

  private indexWindow(keys: List<TKey>, start: number, end: number): void {
    for (let index = (end - 1) | 0; index >= start; index = (index - 1) | 0) {
      const key = keys.get(index);
      this._laterPositions[(index - start) | 0] = this._nextPositions.getValueOrDefault(key, KeyedMap.noPosition);
      this._nextPositions.set(key, index);
    }
  }

  private pairWithIndex(start: number, oldEnd: number): List<ScopeOwner> | null {
    let removed = null as List<ScopeOwner> | null;
    for (let index = start; index < oldEnd; index++) {
      const key = this._keys.get(index);
      const position = this._nextPositions.getValueOrDefault(key, KeyedMap.noPosition);

      if (position !== KeyedMap.noPosition) {
        this._previousPositions[(position - start) | 0] = index;
        this._nextPositions.set(key, this._laterPositions[(position - start) | 0]!);
      } else {
        removed ??= new List<ScopeOwner>();
        removed.add(this._owners[index]!);
      }
    }

    return removed;
  }

  private buildResults(items: IReadOnlyList<T>, start: number, newEnd: number, owners: ScopeOwner[]): List<TResult> {
    const results = List.withCapacity<TResult>(items.count);
    let created = null as List<ScopeOwner> | null;
    this.copyKept(results, owners, 0, start, 0);
    try {
      for (let index = start; index < newEnd; index++) {
        const previous = this._previousPositions[(index - start) | 0]!;

        if (previous !== KeyedMap.noPosition) {
          owners[index] = this._owners[previous]!;
          results.add(this._results.get(previous));
          continue;
        }

        const owner = this.createItemOwner();
        created ??= new List<ScopeOwner>();
        created.add(owner);
        owners[index] = owner;
        results.add(this.mapUnder(owner, items.get(index)));
      }
    } catch (_err) {
      KeyedMap.disposeAll(created);
      throw _err;
    }
    this.copyKept(results, owners, newEnd, items.count, (this._owners.length - items.count) | 0);

    return results;
  }

  private copyKept(results: List<TResult>, owners: ScopeOwner[], from: number, to: number, shift: number): void {
    for (let index = from; index < to; index++) {
      owners[index] = this._owners[(index + shift) | 0]!;
      results.add(this._results.get((index + shift) | 0));
    }
  }

  private createItemOwner(): ScopeOwner {
    const previousOwner = Tracking.currentOwner;
    Tracking.currentOwner = this._listOwner;
    const owner = new ScopeOwner();
    Tracking.currentOwner = previousOwner;

    return owner;
  }

  private mapUnder(owner: ScopeOwner, item: T): TResult {
    const previousOwner = Tracking.currentOwner;
    Tracking.currentOwner = owner;
    try {
      return this._map(item);
    } finally {
      Tracking.currentOwner = previousOwner;

      if (owner.isDisposed) {
        owner.disposeOwned();
      }
    }
  }

  private static resultComparer<TResult>(): IEqualityComparer<IReadOnlyList<TResult>> {
    return new ListIdentityComparer<TResult>();
  }

  private static keysEqual<TKey>(left: TKey, right: TKey): boolean {
    return defaultEqualityComparerFor().equals(left, right);
  }

  private static disposeAll(owners: List<ScopeOwner> | null): void {
    if (owners == null) {
      return;
    }

    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = owners;
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const owner = $a[$i]!;
        owner.dispose();
      }
    }
  }
}
