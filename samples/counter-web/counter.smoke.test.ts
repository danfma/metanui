import { expect, test } from "bun:test";
import { attachRenderFixture, type FakeNode, findAll, flushMicrotasks } from "metanui-fake-dom";
import { CounterApp } from "metanui-samples-counter/metanui/samples/counter";

// Smoke test of the counter sample on the fake DOM, rendered as main.ts does: clicks run the
// handlers, and the microtask scheduler flushes between them, as in the browser.

const { container, render } = attachRenderFixture();

const elementChildren = (parent: FakeNode) =>
  parent.childNodes.filter((child) => !child.nodeName.startsWith("#"));

const one = (scope: FakeNode, match: (node: FakeNode) => boolean) => {
  const found = findAll(scope, match);

  expect(found).toHaveLength(1);

  return found[0]!;
};

const counters = (scope: FakeNode) => findAll(scope, (node) => node.className === "counter");

const counterText = (counter: FakeNode) => counter.childNodes[0]!.textContent;

const button = (scope: FakeNode, label: string) =>
  one(scope, (node) => node.nodeName === "button" && node.textContent === label);

const click = async (scope: FakeNode, label: string) => {
  button(scope, label).dispatch("click");
  await flushMicrotasks();
};

const mountList = () => {
  const target = container();

  render(target, CounterApp.build);

  return one(target, (node) => node.className === "counter-list");
};

test("the standalone counter counts and its label follows the field", async () => {
  const target = container();

  render(target, CounterApp.build);

  const field = one(target, (node) => node.nodeName === "input");
  const solo = counters(target)[0]!;

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

test("the list adds counters, keeps each one's state, and disposes removed ones", async () => {
  const list = mountList();
  const summary = () => one(list, (node) => node.nodeName === "p").textContent;
  const rows = () => counters(list);

  expect(summary()).toBe("In list: 0");

  for (let added = 0; added < 3; added++) {
    await click(list, "Add counter");
  }

  expect(rows().map(counterText)).toEqual(["#1: 0", "#2: 0", "#3: 0"]);
  expect(summary()).toBe("In list: 3");

  await click(rows()[1]!, "+1");
  await click(rows()[1]!, "+1");
  await click(rows()[2]!, "-1");

  expect(rows().map(counterText)).toEqual(["#1: 0", "#2: 2", "#3: -1"]);

  const [first, second, third] = rows();

  await click(first!, "remove");

  expect(rows()).toEqual([second!, third!]);
  expect(rows().map(counterText)).toEqual(["#2: 2", "#3: -1"]);
  expect(summary()).toBe("In list: 2");
  expect(first!.parentNode).toBeNull();

  // Its listeners outlive it (HtmlEvents), but its owner is disposed: its binding no longer runs.
  await click(first!, "+1");

  expect(counterText(first!)).toBe("#1: 0");

  await click(list, "Add counter");
  await click(rows()[0]!, "+1");

  expect(rows().map(counterText)).toEqual(["#2: 3", "#3: -1", "#4: 0"]);
  expect(summary()).toBe("In list: 3");

  expect(elementChildren(list).map((child) => child.nodeName)).toEqual([
    "h2",
    "p",
    "button",
    "div",
    "div",
    "div",
  ]);
});
