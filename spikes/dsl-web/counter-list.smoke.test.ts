import { beforeAll, expect, test } from "bun:test";

// Smoke test of option H's Counter and CounterList on a minimal fake DOM: the gallery is the
// transpiled C#, mounted as in the browser; clicks run the handlers and the microtask scheduler flushes.

class FakeNode {
  readonly children: FakeNode[] = [];
  readonly listeners: (() => void)[] = [];
  parent: FakeNode | null = null;
  className = "";

  constructor(
    readonly tag: string,
    public data = "",
  ) {}

  appendChild(child: FakeNode): FakeNode {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);

    return child;
  }

  removeChild(child: FakeNode): FakeNode {
    const index = this.children.indexOf(child);

    if (index < 0) {
      throw new Error("removeChild: not a child");
    }

    this.children.splice(index, 1);
    child.parent = null;

    return child;
  }

  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener);
  }

  get textContent(): string {
    return this.tag === "#text" ? this.data : this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of this.children.splice(0)) {
      child.parent = null;
    }

    if (value !== "") {
      this.appendChild(new FakeNode("#text", value));
    }
  }

  click(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  findAll(match: (node: FakeNode) => boolean): FakeNode[] {
    const own = match(this) ? [this] : [];

    return own.concat(this.children.flatMap((child) => child.findAll(match)));
  }
}

const body = new FakeNode("body");

let counterType: { live: number };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const section = (title: string) => {
  const found = body.findAll((node) => node.tag === "section" && node.children[0]?.textContent === title);

  expect(found).toHaveLength(1);

  return found[0]!;
};

const button = (scope: FakeNode, label: string, index = 0) =>
  scope.findAll((node) => node.tag === "button" && node.textContent === label)[index]!;

const rows = (scope: FakeNode) => scope.findAll((node) => node.className === "counter-row");

const rowText = (row: FakeNode) => row.children[0]!.textContent.trim();

beforeAll(async () => {
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeNode(tag),
      createTextNode: (data: string) => new FakeNode("#text", data),
    },
  });

  const { Gallery } = await import("metanui-spike-dsl/metanui/spike/dsl");

  counterType = (await import("metanui-spike-dsl/metanui/spike/dsl/variants/direct")).Counter;

  Gallery.main();
  await flush();
});

test("a standalone counter counts", async () => {
  const solo = body.findAll((node) => node.className === "counter-row" && rowText(node).startsWith("Solo"))[0]!;

  // One flush per click, as in the browser: a read after a write returns the committed value until
  // the flush (spec 0001, Solid 2.0), so two increments in the same tick count once.
  button(solo, "+1").click();
  await flush();
  button(solo, "+1").click();
  await flush();

  expect(rowText(solo)).toBe("Solo: 2");
});

// Fails today: the spike's For creates each item's root in the list effect's compute, and the core
// disposes everything a compute owns when it runs again, so adding a counter kills the earlier ones'
// bindings (their rows stay in the DOM). A keyed list needs a core primitive (Solid's mapArray, or
// an owner the list keeps across runs).
test.failing("the list adds counters, keeps each one's state, and disposes removed ones", async () => {
  const list = section("H. CounterList");
  const summary = () => `${list.children[1]!.textContent}, live: ${counterType.live}`;

  expect(summary()).toBe("In list: 0, live: 1");

  for (let added = 0; added < 3; added++) {
    button(list, "Add counter").click();
    await flush();
  }

  expect(rows(list).map(rowText)).toEqual(["#1: 0", "#2: 0", "#3: 0"]);
  expect(summary()).toBe("In list: 3, live: 4");

  button(rows(list)[1]!, "+1").click();
  await flush();
  button(rows(list)[1]!, "+1").click();
  await flush();
  button(rows(list)[2]!, "-1").click();
  await flush();

  expect(rows(list).map(rowText)).toEqual(["#1: 0", "#2: 2", "#3: -1"]);

  const second = rows(list)[1]!;

  button(rows(list)[0]!, "remove").click();
  await flush();

  expect(rows(list).map(rowText)).toEqual(["#2: 2", "#3: -1"]);
  expect(rows(list)[0]).toBe(second);
  expect(summary()).toBe("In list: 2, live: 3");

  button(list, "Add counter").click();
  await flush();
  button(rows(list)[0]!, "+1").click();
  await flush();

  expect(rows(list).map(rowText)).toEqual(["#2: 3", "#3: -1", "#4: 0"]);
  expect(summary()).toBe("In list: 3, live: 4");
});
