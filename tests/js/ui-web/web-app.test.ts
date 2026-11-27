import { afterAll, afterEach, expect, test } from "bun:test";
import { List } from "metano-runtime/system/collections";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import { li, MicrotaskScheduler, p, span, ul, WebApp } from "metanui-ui-web/metanui/ui/web";
import {
  type FakeNode,
  findAll,
  findTag,
  flushMicrotasks,
  installFakeDocument,
  printChildren,
} from "./fake-dom.ts";

// WebApp.render: the microtask scheduler, disposal, and For/Show regions held by comment anchors.

const fakeDocument = installFakeDocument();
const cleanups: Array<() => void> = [];

const container = () => fakeDocument.document.createElement("main");

const render = (target: FakeNode, build: () => void) => {
  const view = WebApp.render(build, target as unknown as HTMLElement);

  cleanups.push(() => view.dispose());

  return view;
};

const snapshot = (items: string[]) => List.adopt(items, { fixedSize: true });

const elementChildren = (parent: FakeNode) =>
  parent.childNodes.filter((child) => !child.nodeName.startsWith("#"));

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }

  Reactivity.useScheduler(new ManualFlushScheduler());
  Reactivity.flush();
});

afterAll(() => {
  fakeDocument.uninstall();
});

test("render installs the microtask scheduler, so a write flushes on the next microtask", async () => {
  const target = container();
  const label = Reactivity.signal("a");

  render(target, () => p(() => View.text(() => label.value)));

  expect(Reactivity.scheduler).toBeInstanceOf(MicrotaskScheduler);

  label.value = "b";

  expect(printChildren(target)).toBe("<p>a</p>");

  await flushMicrotasks();

  expect(printChildren(target)).toBe("<p>b</p>");
});

test("render replaces a scheduler installed before it", () => {
  Reactivity.useScheduler(new ManualFlushScheduler());
  render(container(), () => {});

  expect(Reactivity.scheduler).toBeInstanceOf(MicrotaskScheduler);
});

test("disposing the view removes its nodes and stops its bindings", async () => {
  const target = container();
  const label = Reactivity.signal("a");
  const view = render(target, () => p(() => View.text(() => label.value)));
  const paragraph = findTag(target, "p");

  view.dispose();

  expect(printChildren(target)).toBe("");

  label.value = "b";
  await flushMicrotasks();

  expect(paragraph.textContent).toBe("a");
});

test("For keeps its items between comment anchors, moves kept nodes and adds no wrapper", async () => {
  const target = container();
  const items = Reactivity.signal(snapshot(["a", "b", "c"]));

  render(target, () =>
    ul(() =>
      View.for(
        () => items.value,
        (item: string) => li(() => View.text(item)),
      ),
    ),
  );

  const list = findTag(target, "ul");
  const rows = () => elementChildren(list);
  const [a, b, c] = rows();

  expect(rows().map((row) => row.textContent)).toEqual(["a", "b", "c"]);
  expect(rows().every((row) => row.nodeName === "li")).toBe(true);
  expect(list.childNodes.some((child) => child.nodeName === "#comment")).toBe(true);

  items.value = snapshot(["c", "a"]);
  await flushMicrotasks();

  expect(rows()).toEqual([c!, a!]);
  expect(b!.parentNode).toBeNull();

  items.value = snapshot(["c", "d", "a"]);
  await flushMicrotasks();

  expect(rows().map((row) => row.textContent)).toEqual(["c", "d", "a"]);
  expect(rows()[0]).toBe(c!);
  expect(rows()[2]).toBe(a!);
});

test("Show swaps its branch before its comment anchor", async () => {
  const target = container();
  const visible = Reactivity.signal(true);

  render(target, () =>
    p(() =>
      View.show(
        () => visible.value,
        () => span(() => View.text("on")),
        () => View.text("off"),
      ),
    ),
  );

  const paragraph = findTag(target, "p");

  expect(paragraph.textContent).toBe("on");
  expect(findAll(paragraph, (node) => node.nodeName === "#comment")).toHaveLength(1);

  visible.value = false;
  await flushMicrotasks();

  expect(paragraph.textContent).toBe("off");
  expect(findAll(paragraph, (node) => node.nodeName === "span")).toHaveLength(0);
  expect(paragraph.childNodes.at(-1)!.nodeName).toBe("#comment");
});
