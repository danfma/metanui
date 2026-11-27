import { afterAll, expect, test } from "bun:test";
import { DomNodePort } from "metanui-ui-web/metanui/ui/web";
import { type FakeNode, installFakeDocument, printChildren } from "./fake-dom.ts";

// The port is exercised through its INodePort surface, with the fake nodes passed as opaque handles.

const fakeDocument = installFakeDocument();
const port = new DomNodePort();

const element = (tagName: string) => fakeDocument.document.createElement(tagName);

const created = (handle: unknown) => handle as FakeNode;

afterAll(() => {
  fakeDocument.uninstall();
});

test("createText makes a text node and setText replaces its data", () => {
  const text = created(port.createText("hello"));

  expect(text.nodeName).toBe("#text");
  expect(text.data).toBe("hello");

  port.setText(text, "bye");

  expect(text.data).toBe("bye");
});

test("createAnchor makes an empty comment node", () => {
  const anchor = created(port.createAnchor());

  expect(anchor.nodeName).toBe("#comment");
  expect(anchor.data).toBe("");
});

test("insert with no anchor appends", () => {
  const parent = element("ul");

  port.insert(parent, element("li"), null);
  port.insert(parent, element("p"), null);

  expect(printChildren(parent)).toBe("<li></li><p></p>");
});

test("insert before an anchor places the node before it", () => {
  const parent = element("div");
  const anchor = port.createAnchor();

  port.insert(parent, anchor, null);
  port.insert(parent, element("span"), anchor);
  port.insert(parent, element("p"), anchor);

  expect(printChildren(parent)).toBe("<span></span><p></p><!---->");
});

test("insert of a node already in the parent moves it", () => {
  const parent = element("div");
  const first = element("h1");
  const second = element("h2");

  port.insert(parent, first, null);
  port.insert(parent, second, null);
  port.insert(parent, second, first);

  expect(printChildren(parent)).toBe("<h2></h2><h1></h1>");
});

test("remove takes the node out of its parent", () => {
  const parent = element("div");
  const child = element("span");

  port.insert(parent, child, null);
  port.remove(parent, child);

  expect(printChildren(parent)).toBe("");
  expect(child.parentNode).toBeNull();
});
