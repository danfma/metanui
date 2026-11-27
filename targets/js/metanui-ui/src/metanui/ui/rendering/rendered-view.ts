import { disposeResource, type IDisposable } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Builder } from "../building/builder.js";
import type { INodePort } from "../i-node-port.js";
import { Fragment } from "../regions/fragment.js";

export class RenderedView implements IDisposable {
  declare private readonly _disposeRoot: () => void;

  constructor(disposeRoot: () => void) {
    this._disposeRoot = disposeRoot;
  }

  /** @internal */
  static start(build: () => void, container: Object, port: INodePort): IDisposable {
    return Reactivity.rootBody<IDisposable>((disposeRoot: () => void) => {
      const view = new RenderedView(disposeRoot);
      const topLevel = new Fragment(port, container, null);
      Reactivity.onCleanup(topLevel.remove.bind(topLevel));
      try {
        Builder.run(port, container, null, topLevel, build);
      } catch (_err) {
        view.dispose();
        throw _err;
      }

      return view;
    });
  }

  dispose(): void {
    this._disposeRoot();
  }

  [Symbol.dispose](): void {
    disposeResource(this, this.dispose);
  }
}
