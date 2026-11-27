import { afterAll, expect, test } from "bun:test";
import { installFakeDocument, printChildren } from "./fake-dom.ts";

// The fake DOM follows the browser where the adapter's tests depend on it.

const fakeDocument = installFakeDocument();
const { document } = fakeDocument;

afterAll(() => {
  fakeDocument.uninstall();
});

test("a listener registered twice for the same type runs once", () => {
  const element = document.createElement("button");
  const calls: string[] = [];
  const listener = () => calls.push("click");

  element.addEventListener("click", listener);
  element.addEventListener("click", listener);
  element.dispatch("click");

  expect(element.listenerCount("click")).toBe(1);
  expect(calls).toEqual(["click"]);
});

test("inserting a node before itself leaves it in place", () => {
  const parent = document.createElement("div");
  const first = document.createElement("h1");
  const second = document.createElement("h2");

  parent.appendChild(first);
  parent.appendChild(second);
  parent.insertBefore(first, first);

  expect(printChildren(parent)).toBe("<h1></h1><h2></h2>");
});

test("textContent of a text node replaces its data", () => {
  const text = document.createTextNode("a");

  text.textContent = "b";

  expect(text.data).toBe("b");
  expect(text.childNodes).toHaveLength(0);
});
