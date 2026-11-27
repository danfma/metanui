import { isString, isType, throwError } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { INodePort$runtimeType, type INodePort } from "../i-node-port.js";
import { Fragment } from "../regions/fragment.js";
import type { Region } from "../regions/region.js";

export class Builder {
  private static readonly noBuilderMessage: string = "No builder is active: create nodes inside View.Render or inside an element's builder.";
  private static readonly childrenGoInContentMessage: string = "Children go in Content: a component's props lambda only sets props; assign the children to Content.";
  private static readonly invokeBody: (obj: () => void) => void = (body: () => void) => body();
  private static _port: INodePort | null = null;
  private static _parent: Object | null = null;
  private static _before: Object | null = null;
  private static _collector: Fragment | null = null;
  private static _rejection: string | null = null;

  private constructor() { }

  /** @internal */
  static get port(): INodePort {
    Builder.requireParent();

    return Builder._port!;
  }

  /** @internal */
  static get parent(): Object {
    return Builder.requireParent();
  }

  static create<TNode>(node: TNode, build: (obj: TNode) => void): void {
    const parent = Builder.requireParent();
    const port = Builder._port!;
    const before = Builder._before;
    const collector = Builder._collector;
    Builder.runPortParentBeforeCollectorRejectionBodyArgument<TNode>(port, node, null, null, null, build, node);
    port.insert(parent, node, before);
    collector?.add(node);
  }

  static add(node: Object): void {
    const parent = Builder.requireParent();
    Builder._port!.insert(parent, node, Builder._before);
    Builder._collector?.add(node);
  }

  /** @internal */
  static addRegion(region: Region, end: Object): void {
    const parent = Builder.requireParent();
    Builder._port!.insert(parent, end, Builder._before);
    Builder._collector?.add(region);
  }

  private static runPortParentBeforeCollectorRejectionBodyArgument<T>(port: INodePort | null, parent: Object | null, before: Object | null, collector: Fragment | null, rejection: string | null, body: (obj: T) => void, argument: T): void {
    const savedPort = Builder._port;
    const savedParent = Builder._parent;
    const savedBefore = Builder._before;
    const savedCollector = Builder._collector;
    const savedRejection = Builder._rejection;
    Builder._port = port;
    Builder._parent = parent;
    Builder._before = before;
    Builder._collector = collector;
    Builder._rejection = rejection;
    try {
      body(argument);
    } finally {
      Builder._port = savedPort;
      Builder._parent = savedParent;
      Builder._before = savedBefore;
      Builder._collector = savedCollector;
      Builder._rejection = savedRejection;
    }
  }

  /** @internal */
  static runPortParentBeforeCollectorBodyArgument<T>(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: (obj: T) => void, argument: T): void {
    Builder.runPortParentBeforeCollectorRejectionBodyArgument<T>(port, parent, before, collector, null, body, argument);
  }

  /** @internal */
  static runPortParentBeforeCollectorBody(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: () => void): void {
    Builder.runPortParentBeforeCollectorRejectionBodyArgument<() => void>(port, parent, before, collector, null, Builder.invokeBody, body);
  }

  /** @internal */
  static run<T>(port: INodePort | null, parent: Object | null, before: Object | null, collector: Fragment | null, rejection: string | null, body: (obj: T) => void, argument: T): void;
  /** @internal */
  static run<T>(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: (obj: T) => void, argument: T): void;
  /** @internal */
  static run(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: () => void): void;
  static run(...args: unknown[]): any {
    if (args.length === 7 && (args[0] === null || isType(args[0], INodePort$runtimeType)) && (args[3] === null || args[3] instanceof Fragment) && (args[4] === null || isString(args[4])) && typeof args[5] === "function") {
      Builder.runPortParentBeforeCollectorRejectionBodyArgument(args[0] as any, args[1] as any, args[2] as any, args[3] as any, args[4] as any, args[5] as any, args[6] as any);

      return;
    }

    if (args.length === 6 && isType(args[0], INodePort$runtimeType) && (args[3] === null || args[3] instanceof Fragment) && typeof args[4] === "function") {
      Builder.runPortParentBeforeCollectorBodyArgument(args[0] as any, args[1] as any, args[2] as any, args[3] as any, args[4] as any, args[5] as any);

      return;
    }

    if (args.length === 5 && isType(args[0], INodePort$runtimeType) && (args[3] === null || args[3] instanceof Fragment) && typeof args[4] === "function") {
      Builder.runPortParentBeforeCollectorBody(args[0] as INodePort, args[1] as Object, args[2] as Object | null, args[3] as Fragment | null, args[4] as () => void);

      return;
    }

    throw new Error("No matching overload for run");
  }

  /** @internal */
  static runRejectingChildren<T>(body: (obj: T) => void, argument: T): void {
    Builder.runPortParentBeforeCollectorRejectionBodyArgument<T>(Builder._port, null, null, null, Builder.childrenGoInContentMessage, body, argument);
  }

  private static requireParent(): Object {
    return Builder._parent ?? throwError(new InvalidOperationException(Builder._rejection ?? Builder.noBuilderMessage));
  }
}
