import { afterAll, afterEach } from "bun:test";
import type { IDisposable } from "metano-runtime";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import { WebApp } from "metanui-ui-web/metanui/ui/web";
import { type FakeNode, installFakeDocument } from "./fake-dom.ts";

/**
 * Attaches the shared render fixture to the current test file: a fake document, and after each
 * test the disposal of every rendered view and the reset of the core to a manual scheduler.
 */
export function attachRenderFixture() {
  const fakeDocument = installFakeDocument();
  const views: IDisposable[] = [];

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

  return {
    container: () => fakeDocument.document.createElement("main"),

    render(target: FakeNode, build: () => void): IDisposable {
      const view = WebApp.render(build, target as unknown as HTMLElement);

      views.push(view);

      return view;
    },
  };
}
