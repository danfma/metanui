import { Reactivity } from "metanui-reactive/metanui/reactive";
import { FusedBinding } from "../binding/fused-binding.js";
import { Builder } from "../building/builder.js";
import type { INodePort } from "../i-node-port.js";
import { Fragment } from "../regions/fragment.js";
import { Region } from "../regions/region.js";

export class ShowRegion extends Region {
  declare private _branch: Fragment | null;
  declare private readonly _end: Object;

  constructor(port: INodePort, parent: Object, end: Object) {
    super(port, parent);
    this._branch = null;
    this._end = end;
  }

  /** @internal */
  override get firstNode(): Object | null {
    return this._branch?.firstNode ?? this._end;
  }

  /** @internal */
  static start(when: () => boolean, then: () => void, otherwise: (() => void) | null): void {
    const target = Builder.target;
    const anchor = target.port.createAnchor();
    const region = new ShowRegion(target.port, target.parent, anchor);
    const condition = Reactivity.computed(when);
    target.insertRegion(region, anchor);
    Reactivity.onCleanup(region.removeEnd.bind(region));
    FusedBinding.start(() => region.present(condition.value ? then : otherwise));
  }

  /** @internal */
  override moveBefore(anchor: Object | null): void {
    this._branch?.moveBefore(anchor);
    this.port.insert(this.parent, this._end, anchor);
  }

  private present(branch: (() => void) | null): void {
    this._branch = null;

    if (branch != null) {
      Reactivity.rootVoid((_: () => void) => this.buildBranch(branch));
    }
  }

  private buildBranch(branch: () => void): void {
    const fragment = new Fragment(this.port, this.parent, null);
    this._branch = fragment;
    Reactivity.onCleanup(fragment.remove.bind(fragment));
    Builder.run(this.port, this.parent, this._end, fragment, branch);
  }

  private removeEnd(): void {
    this.port.remove(this.parent, this._end);
  }
}
