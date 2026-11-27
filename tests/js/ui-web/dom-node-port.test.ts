import { afterAll, expect, test } from "bun:test";
import { type FakeNode, installFakeDocument } from "metanui-fake-dom";
import { DomNodePort } from "metanui-ui-web/metanui/ui/web";

// What DomNodePort adds to the INodePort contract (port-contract.test.ts runs the contract itself):
// the DOM node kinds it creates.

const fakeDocument = installFakeDocument();
const port = new DomNodePort();

const created = (handle: unknown) => handle as FakeNode;

afterAll(() => {
  fakeDocument.uninstall();
});

test("createText makes a DOM text node", () => {
  const text = created(port.createText("hello"));

  expect(text.nodeName).toBe("#text");
  expect(text.data).toBe("hello");
});

test("createAnchor makes an empty comment node", () => {
  const anchor = created(port.createAnchor());

  expect(anchor.nodeName).toBe("#comment");
  expect(anchor.data).toBe("");
});
