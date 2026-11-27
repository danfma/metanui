import { afterAll, afterEach, expect, test } from "bun:test";
import type { IDisposable } from "metano-runtime";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import {
  button,
  div,
  h1,
  h2,
  h3,
  input,
  li,
  onClick,
  onInput,
  p,
  section,
  span,
  ul,
  WebApp,
} from "metanui-ui-web/metanui/ui/web";
import {
  type FakeNode,
  findTag,
  flushMicrotasks,
  installFakeDocument,
  printChildren,
} from "./fake-dom.ts";

// The element factories and the event extensions, built through WebApp.render into a fake DOM.

const fakeDocument = installFakeDocument();
const views: IDisposable[] = [];

const container = () => fakeDocument.document.createElement("main");

const renderInto = (target: FakeNode, build: () => void) => {
  views.push(WebApp.render(build, target as unknown as HTMLElement));
};

afterEach(() => {
  for (const view of views.splice(0)) {
    view.dispose();
  }

  Reactivity.useScheduler(new ManualFlushScheduler());
  Reactivity.flush();
});

afterAll(() => {
  fakeDocument.uninstall();
});

test("each factory creates its element at the insertion point, with no wrapper", () => {
  const target = container();

  renderInto(target, () => {
    div(() => {});
    span(() => {});
    p(() => {});
    h1(() => {});
    h2(() => {});
    h3(() => {});
    section(() => {});
    button(() => {});
    input(() => {});
    ul(() => {});
    li(() => {});
  });

  expect(printChildren(target)).toBe(
    "<div></div><span></span><p></p><h1></h1><h2></h2><h3></h3><section></section>" +
      "<button></button><input></input><ul></ul><li></li>",
  );
});

test("the builder receives its element, and children attach to it", () => {
  const target = container();

  renderInto(target, () => {
    section((card) => {
      card.className = "card";

      h2((heading) => {
        heading.textContent = "Title";
      });

      p(() => View.text("body"));
    });
  });

  expect(printChildren(target)).toBe('<section class="card"><h2>Title</h2><p>body</p></section>');
});

test("a factory outside a builder throws", () => {
  expect(() => div(() => {})).toThrow("No builder is active");
});

test("input and button hand their typed element to the builder", () => {
  const target = container();

  renderInto(target, () => {
    input((field) => {
      field.value = "draft";
      field.checked = true;
      field.disabled = true;
    });

    button((action) => {
      action.disabled = true;
    });
  });

  const field = findTag(target, "input");

  expect(field.value).toBe("draft");
  expect(field.checked).toBe(true);
  expect(field.disabled).toBe(true);
  expect(findTag(target, "button").disabled).toBe(true);
});

test("onClick runs the handler on each click, and the bound text follows on the next microtask", async () => {
  const target = container();
  const count = Reactivity.signal(0);

  renderInto(target, () => {
    button((action) => {
      View.bind(() => {
        action.textContent = `Count: ${count.value}`;
      });

      onClick(action, () => count.update((value: number) => value + 1));
    });
  });

  const action = findTag(target, "button");

  expect(action.textContent).toBe("Count: 0");

  action.dispatch("click");
  await flushMicrotasks();
  action.dispatch("click");
  await flushMicrotasks();

  expect(action.textContent).toBe("Count: 2");
  expect(action.listenerCount("click")).toBe(1);
});

test("onInput passes the element's current value to the handler", () => {
  const target = container();
  const received: string[] = [];

  renderInto(target, () => {
    input((field) => onInput(field, (value: string) => received.push(value)));
  });

  const field = findTag(target, "input");

  field.value = "a";
  field.dispatch("input");
  field.value = "ab";
  field.dispatch("input");

  expect(received).toEqual(["a", "ab"]);
});
