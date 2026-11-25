import type { ClassType } from "metano-runtime";
import type { Link } from "./link.js";
import { ReactiveFlags } from "./reactive-flags.js";

let ReactiveNode$rt: ClassType<ReactiveNode> | undefined;

export abstract class ReactiveNode {
  /** @internal */
  deps: Link | null = null;

  /** @internal */
  depsTail: Link | null = null;

  /** @internal */
  subs: Link | null = null;

  /** @internal */
  subsTail: Link | null = null;

  /** @internal */
  flags: ReactiveFlags = ReactiveFlags.None;

  constructor() { }

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
  abstract update(): boolean;

  /** @internal */
  abstract notify(): void;

  /** @internal */
  unwatched(): void {
  }
}
