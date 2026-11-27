import { expect, test } from "bun:test";
import { attachRenderFixture, type FakeNode, findAll, flushMicrotasks } from "metanui-fake-dom";
import { CounterApp } from "metanui-samples-counter/metanui/samples/counter";

// Smoke test of the counter sample (samples/counter-web) on the fake DOM, built as main.ts does:
// clicks run the handlers, and the microtask scheduler flushes between them, as in the browser.

const { container, render } = attachRenderFixture();

const one = (scope: FakeNode, match: (node: FakeNode) => boolean) => {
  const found = findAll(scope, match);

  expect(found).toHaveLength(1);

  return found[0]!;
};

const counters = (scope: FakeNode) => findAll(scope, (node) => node.className === "counter");

const counterText = (counter: FakeNode) => one(counter, (node) => node.nodeName === "span").textContent;

const click = async (scope: FakeNode, label: string) => {
  one(scope, (node) => node.nodeName === "button" && node.textContent === label).dispatch("click");
  await flushMicrotasks();
};

const mountApp = () => {
  const target = container();

  render(target, CounterApp.build);

  return target;
};

const mountList = () => {
  const list = one(mountApp(), (node) => node.className === "counter-list");

  return {
    list,
    rows: () => counters(list),
    summary: () => one(list, (node) => node.nodeName === "p").textContent,
    add: () => click(list, "Add counter"),
  };
};

test("the standalone counter counts and its label follows the field", async () => {
  const app = mountApp();
  const field = one(app, (node) => node.nodeName === "input");
  const solo = counters(app)[0]!;

  expect(field.value).toBe("Solo");
  expect(counterText(solo)).toBe("Solo: 0");
  expect(findAll(solo, (node) => node.textContent === "remove")).toHaveLength(0);

  await click(solo, "+1");
  await click(solo, "+1");
  await click(solo, "-1");

  field.value = "Ada";
  field.dispatch("input");
  await flushMicrotasks();

  expect(counterText(solo)).toBe("Ada: 1");
});

test("the list adds counters in order and counts them", async () => {
  const { rows, summary, add } = mountList();

  expect(summary()).toBe("In list: 0");

  await add();
  await add();
  await add();

  expect(rows().map(counterText)).toEqual(["#1: 0", "#2: 0", "#3: 0"]);
  expect(summary()).toBe("In list: 3");
});

test("each counter keeps its own state and node while others come and go", async () => {
  const { rows, summary, add } = mountList();

  await add();
  await add();
  await add();
  await click(rows()[1]!, "+1");
  await click(rows()[1]!, "+1");
  await click(rows()[2]!, "-1");

  expect(rows().map(counterText)).toEqual(["#1: 0", "#2: 2", "#3: -1"]);

  const [first, second, third] = rows();

  await click(first!, "remove");

  expect(rows()).toHaveLength(2);
  expect(rows()[0]).toBe(second!);
  expect(rows()[1]).toBe(third!);
  expect(summary()).toBe("In list: 2");

  await add();
  await click(second!, "+1");

  expect(rows()[0]).toBe(second!);
  expect(rows().map(counterText)).toEqual(["#2: 3", "#3: -1", "#4: 0"]);
});

test("removing a counter detaches it and disposes its binding", async () => {
  const { rows, add } = mountList();

  await add();

  const removed = rows()[0]!;

  await click(removed, "remove");

  expect(rows()).toHaveLength(0);
  expect(removed.parentNode).toBeNull();

  // Relies on listeners outliving their node (HtmlEvents never removes one): the detached "+1"
  // still writes the count, but the counter's owner is disposed, so its label binding never runs.
  await click(removed, "+1");

  expect(counterText(removed)).toBe("#1: 0");
});

test("the list adds no wrapper element around its counters", async () => {
  const { list, add } = mountList();

  await add();
  await add();

  const elements = list.childNodes.filter((child) => !child.nodeName.startsWith("#"));

  expect(elements.map((child) => child.nodeName)).toEqual(["h2", "p", "button", "div", "div"]);
});
