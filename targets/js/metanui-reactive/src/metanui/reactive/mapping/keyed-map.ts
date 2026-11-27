import { Dictionary, List, throwModified, type IEqualityComparer, type IReadOnlyList } from "metano-runtime/system/collections";
import { arrayLength, defaultEqualityComparerFor, intDiv } from "metano-runtime";
import { Computed } from "../computed.js";
import { Tracking } from "../tracking.js";
import { ListIdentityComparer } from "./list-identity-comparer.js";
import { MapOwner } from "./map-owner.js";

export class KeyedMap<T, TKey, TResult> {
  private static readonly noPosition: number = -1;
  declare private readonly _source: () => IReadOnlyList<T>;
  declare private readonly _key: (arg: T) => TKey;
  declare private readonly _map: (arg: T) => TResult;
  declare private readonly _keyComparer: IEqualityComparer<TKey>;
  declare private readonly _listOwner: MapOwner;
  declare private readonly _mapped: Computed<IReadOnlyList<TResult>>;
  declare private readonly _nextPositions: Dictionary<TKey, number>;
  declare private _keys: List<TKey>;
  declare private _results: List<TResult>;
  declare private _owners: MapOwner[];

  constructor(source: () => IReadOnlyList<T>, key: (arg: T) => TKey, map: (arg: T) => TResult) {
    this._source = undefined!;
    this._key = undefined!;
    this._map = undefined!;
    this._keyComparer = defaultEqualityComparerFor();
    this._listOwner = undefined!;
    this._mapped = undefined!;
    this._nextPositions = (new Dictionary<TKey, number>());
    this._keys = new List<TKey>();
    this._results = new List<TResult>();
    this._owners = [];
    this._source = source;
    this._key = key;
    this._map = map;
    this._listOwner = new MapOwner();
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
    const previousPositions = new Array<number>(arrayLength((newEnd - start) | 0)).fill(0);
    const removed = this.pairKeptItems(keys, start, newEnd, oldEnd, previousPositions);
    const owners = new Array(arrayLength(keys.count)).fill(null);
    const results = this.buildResults(items, start, newEnd, previousPositions, owners);
    this._keys = keys;
    this._owners = owners;
    this._results = results;
    KeyedMap.disposeAll(removed);

    return results;
  }

  private commonPrefixLength(items: IReadOnlyList<T>): number {
    const limit = Math.min(items.count, this._keys.count);
    let start = 0;
    while (start < limit && this._keyComparer.equals(this._keys.get(start), this._key(items.get(start)))) {
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
    while (length < limit && this._keyComparer.equals(this._keys.get((this._keys.count - 1 - length) | 0), keys.get((keys.count - 1 - length) | 0))) {
      length = (length + 1) | 0;
    }

    return length;
  }

  private anyKeyOccursIn(source: List<TKey>, from: number, to: number, suffix: List<TKey>, suffixStart: number): boolean {
    for (let index = from; index < to; index++) {
      for (let other = suffixStart; other < suffix.count; other++) {
        if (this._keyComparer.equals(source.get(index), suffix.get(other))) {
          return true;
        }
      }
    }

    return false;
  }

  private pairKeptItems(keys: List<TKey>, start: number, newEnd: number, oldEnd: number, previousPositions: number[]): List<MapOwner> | null {
    for (let slot = 0; slot < previousPositions.length; slot++) {
      previousPositions[slot] = KeyedMap.noPosition;
    }

    if (oldEnd === start) {
      return null;
    }

    const laterPositions = this.indexWindow(keys, start, newEnd);
    let removed = null as List<MapOwner> | null;
    for (let index = start; index < oldEnd; index++) {
      const key = this._keys.get(index);
      const position = this._nextPositions.getValueOrDefault(key, KeyedMap.noPosition);

      if (position !== KeyedMap.noPosition) {
        previousPositions[(position - start) | 0] = index;
        this._nextPositions.set(key, laterPositions[(position - start) | 0]!);
      } else {
        removed ??= new List<MapOwner>();
        removed.add(this._owners[index]!);
      }
    }
    this._nextPositions.clear();

    return removed;
  }

  private indexWindow(keys: List<TKey>, start: number, end: number): number[] {
    const laterPositions = new Array<number>(arrayLength((end - start) | 0)).fill(0);
    for (let index = (end - 1) | 0; index >= start; index = (index - 1) | 0) {
      const key = keys.get(index);
      laterPositions[(index - start) | 0] = this._nextPositions.getValueOrDefault(key, KeyedMap.noPosition);
      this._nextPositions.set(key, index);
    }

    return laterPositions;
  }

  private buildResults(items: IReadOnlyList<T>, start: number, newEnd: number, previousPositions: number[], owners: MapOwner[]): List<TResult> {
    const results = List.withCapacity<TResult>(items.count);
    let created = null as List<MapOwner> | null;
    this.copyKept(results, owners, 0, start, 0);
    try {
      for (let index = start; index < newEnd; index++) {
        const previous = previousPositions[(index - start) | 0]!;

        if (previous !== KeyedMap.noPosition) {
          owners[index] = this._owners[previous]!;
          results.add(this._results.get(previous));
          continue;
        }

        const owner = this.createItemOwner();
        created ??= new List<MapOwner>();
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

  private copyKept(results: List<TResult>, owners: MapOwner[], from: number, to: number, shift: number): void {
    for (let index = from; index < to; index++) {
      owners[index] = this._owners[(index + shift) | 0]!;
      results.add(this._results.get((index + shift) | 0));
    }
  }

  private createItemOwner(): MapOwner {
    const previousOwner = Tracking.currentOwner;
    Tracking.currentOwner = this._listOwner;
    const owner = new MapOwner();
    Tracking.currentOwner = previousOwner;

    return owner;
  }

  private mapUnder(owner: MapOwner, item: T): TResult {
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

  private static disposeAll(owners: List<MapOwner> | null): void {
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
