import type { ClassType } from "metano-runtime";
import type { Link } from "./link.js";
import { ReactiveFlags } from "./reactive-flags.js";

let ReactiveNode$rt: ClassType<ReactiveNode> | undefined;

export abstract class ReactiveNode {
  /** @internal */
  declare deps: Link | null;

  /** @internal */
  declare depsTail: Link | null;

  /** @internal */
  declare subs: Link | null;

  /** @internal */
  declare subsTail: Link | null;

  /** @internal */
  declare flags: ReactiveFlags;

  constructor() {
    this.deps = null;
    this.depsTail = null;
    this.subs = null;
    this.subsTail = null;
    this.flags = ReactiveFlags.None;
  }

  static get $runtimeType(): ClassType<ReactiveNode> {
    return (ReactiveNode$rt ??= {
      kind: "class",
      name: "ReactiveNode",
      fullName: "Metanui.Reactive.Graph.ReactiveNode",
      namespace: "Metanui.Reactive.Graph",
      ctor: ReactiveNode,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is ReactiveNode => v instanceof ReactiveNode,
    });
  }

  /** @internal */
  abstract refresh(): boolean;

  /** @internal */
  abstract notify(): void;

  /** @internal */
  unwatched(): void {
  }
}
