import { HashCode, copyRecordWith } from "metano-runtime";
import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Scenario, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "./fakes/fake-element.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

class ForScenarios$Entry {
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

  with(overrides?: Partial<ForScenarios$Entry>): ForScenarios$Entry {
    return copyRecordWith<ForScenarios$Entry>(this, overrides);
  }

  toString(): string {
    return `Entry { Id = ${this.id}, Name = ${this.name} }`;
  }
}

export class ForScenarios {
  static readonly all: Scenario[] = [new Scenario("for keeps item state across add, remove and reorder", ForScenarios.forKeepsItemStateAcrossAddRemoveAndReorder), new Scenario("for moves only the items out of place", ForScenarios.forMovesOnlyTheItemsOutOfPlace), new Scenario("a prepend or a middle insert moves no kept item", ForScenarios.aPrependOrAMiddleInsertMovesNoKeptItem), new Scenario("an item that throws inside a boundary leaves the list consistent", ForScenarios.anItemThatThrowsInsideABoundaryLeavesTheListConsistent), new Scenario("keyed for keeps an item whose record changes", ForScenarios.keyedForKeepsAnItemWhoseRecordChanges), new Scenario("moved items take their nested regions along", ForScenarios.movedItemsTakeTheirNestedRegionsAlong), new Scenario("an item rendering several nodes moves them together", ForScenarios.anItemRenderingSeveralNodesMovesThemTogether), new Scenario("clearing the list removes every item node", ForScenarios.clearingTheListRemovesEveryItemNode), new Scenario("for stays between its siblings", ForScenarios.forStaysBetweenItsSiblings)];

  private constructor() { }

  private static forKeepsItemStateAcrossAddRemoveAndReorder(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c"], { fixedSize: true }));
    let renders = 0;
    const disposed = new List<string>();
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      renders = (renders + 1) | 0;
      Reactivity.onCleanup(() => disposed.add(item));
      FakeViews.labelText(item);
    }));
    expect.equal("label\"a\" label\"b\" label\"c\"", host.print(), "initial");
    items.value = List.adopt<string>(["d", "a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"d\" label\"a\" label\"b\" label\"c\"", host.print(), "added");
    expect.equal(4, renders, "only the added item renders");
    items.value = List.adopt<string>(["d", "a", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"d\" label\"a\" label\"c\"", host.print(), "removed");
    expect.equal("b", [...disposed].join(","), "only the removed item is disposed");
    items.value = List.adopt<string>(["c", "a", "d"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"c\" label\"a\" label\"d\"", host.print(), "reordered");
    expect.equal(4, renders, "a reorder renders nothing");
    expect.equal(1, disposed.count, "a reorder disposes nothing");
  }

  private static forMovesOnlyTheItemsOutOfPlace(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c", "d", "e"], { fixedSize: true }));
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => FakeViews.labelText(item)));
    items.value = List.adopt<string>(["a", "d", "c", "b", "e"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"a\" label\"d\" label\"c\" label\"b\" label\"e\"", host.print(), "swapped");
    expect.equal(4, host.port.moves, "two items move");
    items.value = List.adopt<string>(["e", "b", "c", "d", "a"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"e\" label\"b\" label\"c\" label\"d\" label\"a\"", host.print(), "reversed");
    expect.equal(12, host.port.moves, "four more items move");
  }

  private static aPrependOrAMiddleInsertMovesNoKeptItem(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c"], { fixedSize: true }));
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => FakeViews.labelText(item)));
    items.value = List.adopt<string>(["d", "a", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"d\" label\"a\" label\"b\" label\"c\"", host.print(), "prepended");
    expect.equal(2, host.port.moves, "only the prepended item moves");
    items.value = List.adopt<string>(["d", "a", "x", "b", "c"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"d\" label\"a\" label\"x\" label\"b\" label\"c\"", host.print(), "inserted in the middle");
    expect.equal(4, host.port.moves, "only the inserted item moves");
  }

  private static anItemThatThrowsInsideABoundaryLeavesTheListConsistent(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const errors = new List<string>();
    Reactivity.errorBoundary(() => host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      FakeViews.labelText(item);

      if (item === "x") {
        throw new InvalidOperationException("boom");
      }
    })), (error: Exception) => errors.add(error.message));
    items.value = List.adopt<string>(["a", "x", "b"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("boom", [...errors].join(","), "routed to the boundary");
    expect.equal("label\"a\" label\"b\"", host.print(), "the failed item left no node");
    items.value = List.adopt<string>(["b", "a"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"b\" label\"a\"", host.print(), "the list follows the next change");
    expect.equal(5, host.container.childCount, "two labels, two item anchors, the list anchor");
  }

  private static keyedForKeepsAnItemWhoseRecordChanges(expect: IExpect): void {
    const host = new FakeHost();
    let renders = 0;
    const items = Reactivity.signal<IReadOnlyList<ForScenarios$Entry>>(List.adopt<ForScenarios$Entry>([new ForScenarios$Entry(1, "one"), new ForScenarios$Entry(2, "two")], { fixedSize: true }));
    host.render(() => View.forItemsKeyRender<ForScenarios$Entry, number>(() => items.value, (entry: ForScenarios$Entry) => entry.id, (entry: ForScenarios$Entry) => {
      renders = (renders + 1) | 0;
      FakeViews.labelText(entry.name);
    }));
    items.value = List.adopt<ForScenarios$Entry>([new ForScenarios$Entry(2, "two"), new ForScenarios$Entry(1, "uno")], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"two\" label\"one\"", host.print(), "kept by key, moved");
    expect.equal(2, renders, "nothing renders again");
  }

  private static movedItemsTakeTheirNestedRegionsAlong(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const marked = Reactivity.signal(true);
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      FakeViews.labelText(item);
      View.show(() => marked.value, () => FakeViews.labelText(`${item}!`));
      View.forItemsRender<string>(() => items.value, (inner: string) => FakeViews.labelText(`${item}${inner}`));
    }));
    items.value = List.adopt<string>(["b", "a"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"b\" label\"b!\" label\"bb\" label\"ba\" label\"a\" label\"a!\" label\"ab\" label\"aa\"", host.print(), "reordered with nested regions");
    marked.value = false;
    Reactivity.flush();
    expect.equal("label\"b\" label\"bb\" label\"ba\" label\"a\" label\"ab\" label\"aa\"", host.print(), "nested branch hidden in place");
  }

  private static anItemRenderingSeveralNodesMovesThemTogether(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b", "c"], { fixedSize: true }));
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      FakeViews.labelText(item);
      View.textString(item);
    }));
    items.value = List.adopt<string>(["c", "a", "b"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"c\" 'c' label\"a\" 'a' label\"b\" 'b'", host.print(), "nodes moved as a group");
  }

  private static clearingTheListRemovesEveryItemNode(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    let live = 0;
    host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      live = (live + 1) | 0;
      Reactivity.onCleanup(() => live = (live - 1) | 0);
      FakeViews.box((box: FakeElement) => FakeViews.labelText(item));
    }));
    items.value = List.adopt<string>([], { fixedSize: true });
    Reactivity.flush();
    expect.equal("", host.print(), "empty");
    expect.equal(1, host.container.childCount, "only the list's end anchor is left");
    expect.equal(0, live, "every item is disposed");
  }

  private static forStaysBetweenItsSiblings(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>([], { fixedSize: true }));
    host.render(() => {
      FakeViews.labelText("first");
      View.forItemsRender<string>(() => items.value, (item: string) => FakeViews.labelText(item));
      FakeViews.labelText("last");
    });
    items.value = List.adopt<string>(["a", "b"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"first\" label\"a\" label\"b\" label\"last\"", host.print(), "tree");
    expect.equal(0, host.port.moves, "an append moves nothing");
  }
}
