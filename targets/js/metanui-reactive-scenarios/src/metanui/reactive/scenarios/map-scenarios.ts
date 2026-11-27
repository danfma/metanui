import { HashCode, copyRecordWith, objectText, throwError } from "metano-runtime";
import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class MapScenarios$Row {
  declare readonly id: number;
  declare readonly name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.id === other.id && this.name === other.name;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.id);
    hc.add(this.name);

    return hc.toHashCode();
  }

  with(overrides?: Partial<MapScenarios$Row>): MapScenarios$Row {
    return copyRecordWith<MapScenarios$Row>(this, overrides);
  }

  toString(): string {
    return `Row { Id = ${this.id}, Name = ${this.name} }`;
  }
}

class MapScenarios$Entry {
  declare readonly id: number;
  declare name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

export class MapScenarios {
  static readonly all: Scenario[] = [new Scenario("items created in a computed are disposed when it reruns", MapScenarios.itemsCreatedInAComputedAreDisposedWhenItReruns), new Scenario("map keeps item owners across source reruns", MapScenarios.mapKeepsItemOwnersAcrossSourceReruns), new Scenario("map is lazy and maps only added items", MapScenarios.mapIsLazyAndMapsOnlyAddedItems), new Scenario("removing the first, middle or last item disposes only that item", MapScenarios.removingAnItemDisposesOnlyThatItem), new Scenario("reorder keeps every item and follows the new order", MapScenarios.reorderKeepsEveryItemAndFollowsTheNewOrder), new Scenario("replacing all items disposes the old ones and maps the new ones", MapScenarios.replacingAllItemsDisposesTheOldOnesAndMapsTheNewOnes), new Scenario("clearing the source disposes every item", MapScenarios.clearingTheSourceDisposesEveryItem), new Scenario("duplicate records pair in order", MapScenarios.duplicateRecordsPairInOrder), new Scenario("key selector keeps a mutated item and its result", MapScenarios.keySelectorKeepsAMutatedItemAndItsResult), new Scenario("disposing the owner disposes every item", MapScenarios.disposingTheOwnerDisposesEveryItem), new Scenario("cleanups run once per removed item", MapScenarios.cleanupsRunOncePerRemovedItem), new Scenario("unchanged rerun keeps the list instance", MapScenarios.unchangedRerunKeepsTheListInstance), new Scenario("item state survives unrelated additions", MapScenarios.itemStateSurvivesUnrelatedAdditions), new Scenario("reads in map are not tracked", MapScenarios.readsInMapAreNotTracked), new Scenario("writing a signal in map or key throws", MapScenarios.writingASignalInMapOrKeyThrows), new Scenario("exception in map keeps the previous mapping", MapScenarios.exceptionInMapKeepsThePreviousMapping), new Scenario("losing the last observer keeps the items", MapScenarios.losingTheLastObserverKeepsTheItems), new Scenario("map that disposes its owner leaves no item alive", MapScenarios.mapThatDisposesItsOwnerLeavesNoItemAlive), new Scenario("creating a map in an apply throws", MapScenarios.creatingAMapInAnApplyThrows)];

  private constructor() { }

  private static itemsCreatedInAComputedAreDisposedWhenItReruns(expect: IExpect): void {
    let disposals = 0;
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const mapped = Reactivity.computed(() => {
      for (const item of items.value) {
        Reactivity.rootVoid((_: () => void) => Reactivity.onCleanup(() => disposals = (disposals + 1) | 0));
      }

      return items.value.count;
    });
    Reactivity.effect(() => mapped.value, (_: number, _1: number) => {
    });
    items.value = List.adopt<string>(["a", "b"], { fixedSize: true });
    Reactivity.flush();
    items.value = List.adopt<string>(["a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal(3, disposals, "every item root of the two previous runs is disposed");
  }

  private static mapKeepsItemOwnersAcrossSourceReruns(expect: IExpect): void {
    let disposals = 0;
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      Reactivity.onCleanup(() => disposals = (disposals + 1) | 0);

      return item;
    });
    Reactivity.effect(() => mapped().count, (_: number, _1: number) => {
    });
    items.value = List.adopt<string>(["a", "b"], { fixedSize: true });
    Reactivity.flush();
    items.value = List.adopt<string>(["a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal(0, disposals, "kept items are never disposed");
  }

  private static mapIsLazyAndMapsOnlyAddedItems(expect: IExpect): void {
    let log = "";
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      log += item + ",";

      return item.toUpperCase();
    });
    expect.equal("", log, "nothing is mapped before the first read");
    expect.equal("A,B", MapScenarios.join(mapped()), "first read");
    items.value = List.adopt<string>(["a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("A,B,C", MapScenarios.join(mapped()), "after append");
    items.value = List.adopt<string>(["z", "a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("Z,A,B,C", MapScenarios.join(mapped()), "after prepend");
    items.value = List.adopt<string>(["z", "a", "m", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("Z,A,M,B,C", MapScenarios.join(mapped()), "after insert in the middle");
    expect.equal("a,b,c,z,m,", log, "each item is mapped once");
  }

  private static removingAnItemDisposesOnlyThatItem(expect: IExpect): void {
    let log = "";
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c", "d", "e"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => MapScenarios.logCleanup(item, () => log += item));
    Reactivity.effect(() => mapped(), (_: IReadOnlyList<string>, _1: IReadOnlyList<string>) => {
    });
    items.value = List.adopt<string>(["b", "c", "d", "e"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("a", log, "removing the first");
    expect.equal("b,c,d,e", MapScenarios.join(mapped()), "list after removing the first");
    items.value = List.adopt<string>(["b", "c", "e"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("ad", log, "removing the middle");
    expect.equal("b,c,e", MapScenarios.join(mapped()), "list after removing the middle");
    items.value = List.adopt<string>(["b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("ade", log, "removing the last");
    expect.equal("b,c", MapScenarios.join(mapped()), "list after removing the last");
  }

  private static reorderKeepsEveryItemAndFollowsTheNewOrder(expect: IExpect): void {
    let maps = 0;
    let disposals = 0;
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c", "d"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      maps = (maps + 1) | 0;
      Reactivity.onCleanup(() => disposals = (disposals + 1) | 0);

      return item;
    });
    const before = mapped();
    items.value = List.adopt<string>(["d", "b", "c", "a"], { fixedSize: true });
    Reactivity.flush();
    const swapped = mapped();
    items.value = List.adopt<string>(["c", "a", "d", "b"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("d,b,c,a", MapScenarios.join(swapped), "swap follows the new order");
    expect.equal("c,a,d,b", MapScenarios.join(mapped()), "shuffle follows the new order");
    expect.isTrue(!(before === swapped), "a move returns a new list");
    expect.equal("a,b,c,d", MapScenarios.join(before), "the list an observer received is not mutated");
    expect.equal(4, maps, "no item is mapped again");
    expect.equal(0, disposals, "no item is disposed");
  }

  private static replacingAllItemsDisposesTheOldOnesAndMapsTheNewOnes(expect: IExpect): void {
    let log = "";
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      log += "+" + item;

      return MapScenarios.logCleanup(item, () => log += "-" + item);
    });
    mapped();
    items.value = List.adopt<string>(["c", "d"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("c,d", MapScenarios.join(mapped()), "list after the replacement");
    expect.equal("+a+b+c+d-a-b", log, "new items map, then old ones are disposed in order");
  }

  private static clearingTheSourceDisposesEveryItem(expect: IExpect): void {
    let log = "";
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => MapScenarios.logCleanup(item, () => log += item));
    mapped();
    items.value = List.adopt<string>([], { fixedSize: true });
    Reactivity.flush();
    expect.equal(0, mapped().count, "empty list");
    expect.equal("abc", log, "every item is disposed, in list order");
  }

  private static duplicateRecordsPairInOrder(expect: IExpect): void {
    let created = 0;
    let log = "";
    const items = Reactivity.signal<IReadOnlyList<MapScenarios$Row>>(List.adopt<MapScenarios$Row>([new MapScenarios$Row(1, "x"), new MapScenarios$Row(1, "x")], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<MapScenarios$Row, number>(() => items.value, (row: MapScenarios$Row) => {
      created = (created + 1) | 0;
      const serial = created;
      Reactivity.onCleanup(() => log += serial);

      return serial;
    });
    expect.equal("1,2", MapScenarios.join(mapped()), "each occurrence is its own item");
    items.value = List.adopt<MapScenarios$Row>([new MapScenarios$Row(1, "x"), new MapScenarios$Row(2, "y"), new MapScenarios$Row(1, "x")], { fixedSize: true });
    Reactivity.flush();
    expect.equal("1,3,2", MapScenarios.join(mapped()), "equal records keep their items in order");
    items.value = List.adopt<MapScenarios$Row>([new MapScenarios$Row(1, "x")], { fixedSize: true });
    Reactivity.flush();
    expect.equal("1", MapScenarios.join(mapped()), "the first occurrence pairs with the first");
    expect.equal("32", log, "the removed record, then the extra occurrence, in list order");
    items.value = List.adopt<MapScenarios$Row>([new MapScenarios$Row(1, "x"), new MapScenarios$Row(1, "x"), new MapScenarios$Row(1, "x")], { fixedSize: true });
    Reactivity.flush();
    expect.equal("1,4,5", MapScenarios.join(mapped()), "extra occurrences are created");
  }

  private static keySelectorKeepsAMutatedItemAndItsResult(expect: IExpect): void {
    let maps = 0;
    const first = new MapScenarios$Entry(1, "one");
    const second = new MapScenarios$Entry(2, "two");
    const items = Reactivity.signal<IReadOnlyList<MapScenarios$Entry>>(List.adopt<MapScenarios$Entry>([first, second], { fixedSize: true }));
    const mapped = Reactivity.mapSourceKeyMap<MapScenarios$Entry, number, string>(() => items.value, (entry: MapScenarios$Entry) => entry.id, (entry: MapScenarios$Entry) => {
      maps = (maps + 1) | 0;

      return entry.name;
    });
    expect.equal("one,two", MapScenarios.join(mapped()), "first read");
    first.name = "uno";
    items.value = List.adopt<MapScenarios$Entry>([second, first, new MapScenarios$Entry(2, "dos")], { fixedSize: true });
    Reactivity.flush();
    expect.equal("two,one,dos", MapScenarios.join(mapped()), "kept keys keep their result");
    expect.equal(3, maps, "only the extra occurrence of key 2 is mapped");
    items.value = List.adopt<MapScenarios$Entry>([new MapScenarios$Entry(2, "deux"), first], { fixedSize: true });
    Reactivity.flush();
    expect.equal("two,one", MapScenarios.join(mapped()), "a new instance with a kept key is not mapped");
    expect.equal(3, maps, "no remap for a kept key");
  }

  private static disposingTheOwnerDisposesEveryItem(expect: IExpect): void {
    let disposals = 0;
    let dispose = () => {
    };
    const mapped = Reactivity.rootBody<() => IReadOnlyList<string>>((disposeRoot: () => void) => {
      dispose = disposeRoot;

      return Reactivity.mapSourceMap<string, string>(() => List.adopt<string>(["a", "b", "c"], { fixedSize: true }), (item: string) => MapScenarios.logCleanup(item, () => disposals = (disposals + 1) | 0));
    });
    expect.equal("a,b,c", MapScenarios.join(mapped()), "read before the disposal");
    dispose();
    expect.equal(3, disposals, "every item owner is disposed");
    expect.equal("a,b,c", MapScenarios.join(mapped()), "a later read returns the last list");
  }

  private static cleanupsRunOncePerRemovedItem(expect: IExpect): void {
    let log = "";
    const tick = Reactivity.signal(0);
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => {
      tick.value;

      return items.value;
    }, (item: string) => MapScenarios.logCleanup(item, () => log += item));
    Reactivity.effect(() => mapped(), (_: IReadOnlyList<string>, _1: IReadOnlyList<string>) => {
    });
    items.value = List.adopt<string>(["b"], { fixedSize: true });
    Reactivity.flush();
    tick.value = 1;
    Reactivity.flush();
    items.value = List.adopt<string>(["b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("a", log, "the removed item is disposed once");
  }

  private static unchangedRerunKeepsTheListInstance(expect: IExpect): void {
    let sourceRuns = 0;
    let observerRuns = 0;
    const tick = Reactivity.signal(0);
    const mapped = Reactivity.mapSourceMap<MapScenarios$Row, string>(() => {
      sourceRuns = (sourceRuns + 1) | 0;
      tick.value;
      const rows = List.adopt<MapScenarios$Row>([new MapScenarios$Row(1, "x"), new MapScenarios$Row(2, "y")], { fixedSize: true });

      return rows;
    }, (row: MapScenarios$Row) => row.name);
    Reactivity.effect(() => {
      observerRuns = (observerRuns + 1) | 0;

      return mapped();
    }, (_: IReadOnlyList<string>, _1: IReadOnlyList<string>) => {
    });
    const before = mapped();
    tick.value = 1;
    Reactivity.flush();
    expect.equal(2, sourceRuns, "the source reran");
    expect.isTrue((before === mapped()), "same list instance");
    expect.equal(1, observerRuns, "the observer does not rerun");
  }

  private static itemStateSurvivesUnrelatedAdditions(expect: IExpect): void {
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, Signal<string>>(() => items.value, (item: string) => Reactivity.signal(item + "0"));
    mapped().get(0).value = "a1";
    Reactivity.flush();
    items.value = List.adopt<string>(["z", "a", "b"], { fixedSize: true });
    Reactivity.flush();
    const counters = mapped();
    expect.equal("z0", counters.get(0).value, "the new item has fresh state");
    expect.equal("a1", counters.get(1).value, "the kept item keeps its signal");
    expect.equal("b0", counters.get(2).value, "the appended item has fresh state");
  }

  private static readsInMapAreNotTracked(expect: IExpect): void {
    let sourceRuns = 0;
    const label = Reactivity.signal("!");
    const keyLabel = Reactivity.signal("?");
    const mapped = Reactivity.mapSourceKeyMap<string, string, string>(() => {
      sourceRuns = (sourceRuns + 1) | 0;

      return List.adopt<string>(["a"], { fixedSize: true });
    }, (item: string) => item + keyLabel.value, (item: string) => item + label.value);
    Reactivity.effect(() => mapped(), (_: IReadOnlyList<string>, _1: IReadOnlyList<string>) => {
    });
    label.value = "?";
    keyLabel.value = "!";
    Reactivity.flush();
    expect.equal(1, sourceRuns, "a read in map or key does not rerun the map");
    expect.equal("a!", MapScenarios.join(mapped()), "the result keeps the first mapping");
  }

  private static writingASignalInMapOrKeyThrows(expect: IExpect): void {
    const target = Reactivity.signal(0);
    const inMap = Reactivity.mapSourceMap<string, number>(() => List.adopt<string>(["a"], { fixedSize: true }), (item: string) => {
      target.value = 1;

      return 0;
    });
    const inKey = Reactivity.mapSourceKeyMap<string, number, string>(() => List.adopt<string>(["a"], { fixedSize: true }), (item: string) => {
      target.value = 1;

      return 0;
    }, (item: string) => item);
    expect.isTrue(ScenarioRunner.catch(() => inMap()) instanceof InvalidOperationException, "write in map throws");
    expect.isTrue(ScenarioRunner.catch(() => inKey()) instanceof InvalidOperationException, "write in key throws");
  }

  private static exceptionInMapKeepsThePreviousMapping(expect: IExpect): void {
    let log = "";
    let maps = 0;
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      maps = (maps + 1) | 0;
      const result = MapScenarios.logCleanup(item, () => log += item);

      return item === "boom" ? throwError(new InvalidOperationException(item)) : result;
    });
    const before = mapped();
    items.value = List.adopt<string>(["b", "boom"], { fixedSize: true });
    Reactivity.flush();
    const error = ScenarioRunner.catch(() => mapped());
    expect.isTrue(error instanceof InvalidOperationException, "the error reaches the reader");
    expect.equal("bboom", log, "the owners the aborted run created are disposed");
    items.value = List.adopt<string>(["a", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("a,c", MapScenarios.join(mapped()), "a later change maps against the previous mapping");
    expect.equal(4, maps, "the kept item is not mapped again");
    expect.equal("bboom", log, "the kept item was never disposed");
    expect.equal("a", MapScenarios.join(before), "the previous list is untouched");
  }

  private static losingTheLastObserverKeepsTheItems(expect: IExpect): void {
    let maps = 0;
    let disposals = 0;
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const mapped = Reactivity.mapSourceMap<string, string>(() => items.value, (item: string) => {
      maps = (maps + 1) | 0;

      return MapScenarios.logCleanup(item, () => disposals = (disposals + 1) | 0);
    });
    const observer = Reactivity.effect(() => mapped(), (_: IReadOnlyList<string>, _1: IReadOnlyList<string>) => {
    });
    Reactivity.flush();
    observer.dispose();
    items.value = List.adopt<string>(["b", "a"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("b,a", MapScenarios.join(mapped()), "the next read reconciles");
    expect.equal(2, maps, "no item is mapped again");
    expect.equal(0, disposals, "no item is disposed");
  }

  private static mapThatDisposesItsOwnerLeavesNoItemAlive(expect: IExpect): void {
    let created = 0;
    let disposals = 0;
    let dispose = () => {
    };
    const mapped = Reactivity.rootBody<() => IReadOnlyList<string>>((disposeRoot: () => void) => {
      dispose = disposeRoot;

      return Reactivity.mapSourceMap<string, string>(() => List.adopt<string>(["a", "stop", "b"], { fixedSize: true }), (item: string) => {
        created = (created + 1) | 0;

        if (item === "stop") {
          dispose();
        }

        return MapScenarios.logCleanup(item, () => disposals = (disposals + 1) | 0);
      });
    });
    expect.equal("a,stop,b", MapScenarios.join(mapped()), "the run completes");
    expect.equal(3, created, "every item was mapped");
    expect.equal(3, disposals, "every item owner is disposed when the run ends");
  }

  private static creatingAMapInAnApplyThrows(expect: IExpect): void {
    let error = null as Exception | null;
    Reactivity.effect(() => 0, (_: number, _1: number) => error = ScenarioRunner.catch(() => Reactivity.mapSourceMap<string, string>(() => List.adopt<string>([], { fixedSize: true }), (item: string) => item)));
    Reactivity.flush();
    expect.isTrue(error instanceof InvalidOperationException, "map in an apply throws");
  }

  private static logCleanup<TItem>(item: TItem, cleanup: () => void): TItem {
    Reactivity.onCleanup(cleanup);

    return item;
  }

  private static join<TItem>(items: IReadOnlyList<TItem>): string {
    let text = "";
    for (let index = 0; index < items.count; index++) {
      text += (index === 0 ? "" : ",") + objectText(items.get(index) ?? "");
    }

    return text;
  }
}
