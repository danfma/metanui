// A minimal fake DOM for the web adapter's tests, ported from the DSL-shapes spike's FakeNode and
// extended with insertBefore, comment nodes and per-type listeners. It implements only what
// metanui-ui-web touches; `installFakeDocument` exposes it as the global `document`.

type Listener = () => void;

export type FakeNode = {
  readonly nodeName: string;
  readonly childNodes: FakeNode[];
  parentNode: FakeNode | null;
  data: string;
  className: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  textContent: string;
  insertBefore(node: FakeNode, child: FakeNode | null): FakeNode;
  appendChild(node: FakeNode): FakeNode;
  removeChild(node: FakeNode): FakeNode;
  addEventListener(type: string, listener: Listener): void;
  dispatch(type: string): void;
  listenerCount(type: string): number;
};

export type FakeDocument = {
  readonly body: FakeNode;
  createElement(tagName: string): FakeNode;
  createTextNode(data: string): FakeNode;
  createComment(data: string): FakeNode;
};

const TEXT = "#text";
const COMMENT = "#comment";

export function createFakeNode(nodeName: string, data = ""): FakeNode {
  const childNodes: FakeNode[] = [];
  const listeners = new Map<string, Listener[]>();

  const detach = (node: FakeNode) => {
    node.parentNode?.removeChild(node);
  };

  const node: FakeNode = {
    nodeName,
    childNodes,
    parentNode: null,
    data,
    className: "",
    value: "",
    checked: false,
    disabled: false,

    get textContent(): string {
      return nodeName === TEXT ? node.data : childNodes.map((child) => child.textContent).join("");
    },

    set textContent(value: string) {
      for (const child of childNodes.splice(0)) {
        child.parentNode = null;
      }

      if (value !== "") {
        node.appendChild(createFakeNode(TEXT, value));
      }
    },

    insertBefore(child: FakeNode, before: FakeNode | null): FakeNode {
      if (before !== null && before.parentNode !== node) {
        throw new Error("insertBefore: the reference node is not a child");
      }

      detach(child);

      const index = before === null ? childNodes.length : childNodes.indexOf(before);

      childNodes.splice(index, 0, child);
      child.parentNode = node;

      return child;
    },

    appendChild(child: FakeNode): FakeNode {
      return node.insertBefore(child, null);
    },

    removeChild(child: FakeNode): FakeNode {
      const index = childNodes.indexOf(child);

      if (index < 0) {
        throw new Error("removeChild: not a child");
      }

      childNodes.splice(index, 1);
      child.parentNode = null;

      return child;
    },

    addEventListener(type: string, listener: Listener): void {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },

    dispatch(type: string): void {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },

    listenerCount(type: string): number {
      return listeners.get(type)?.length ?? 0;
    },
  };

  return node;
}

/** Serializes a node as markup: elements with their class, text as is, comments as `<!---->`. */
export function print(node: FakeNode): string {
  if (node.nodeName === TEXT) {
    return node.data;
  }

  if (node.nodeName === COMMENT) {
    return `<!--${node.data}-->`;
  }

  const attributes = node.className === "" ? "" : ` class="${node.className}"`;
  const children = node.childNodes.map(print).join("");

  return `<${node.nodeName}${attributes}>${children}</${node.nodeName}>`;
}

/** The markup of a container's children, without the container itself. */
export function printChildren(container: FakeNode): string {
  return container.childNodes.map(print).join("");
}

export function findAll(scope: FakeNode, match: (node: FakeNode) => boolean): FakeNode[] {
  const own = match(scope) ? [scope] : [];

  return own.concat(scope.childNodes.flatMap((child) => findAll(child, match)));
}

export function findTag(scope: FakeNode, tagName: string, index = 0): FakeNode {
  const found = findAll(scope, (node) => node.nodeName === tagName)[index];

  if (found === undefined) {
    throw new Error(`no <${tagName}> #${index} under <${scope.nodeName}>`);
  }

  return found;
}

/** Installs a fresh fake document as the global `document`; returns it and its uninstaller. */
export function installFakeDocument(): { document: FakeDocument; uninstall: () => void } {
  const document: FakeDocument = {
    body: createFakeNode("body"),
    createElement: (tagName: string) => createFakeNode(tagName),
    createTextNode: (data: string) => createFakeNode(TEXT, data),
    createComment: (data: string) => createFakeNode(COMMENT, data),
  };

  const host = globalThis as { document?: unknown };
  const previous = host.document;

  host.document = document;

  return {
    document,

    uninstall() {
      host.document = previous;
    },
  };
}

/** Lets the microtask scheduler run the pending flush. */
export const flushMicrotasks = () => Promise.resolve();
