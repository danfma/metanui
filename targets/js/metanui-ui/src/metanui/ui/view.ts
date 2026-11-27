import type { IReadOnlyList } from "metano-runtime/system/collections";
import { isString, type IDisposable } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { FusedBinding } from "./binding/fused-binding.js";
import { SplitBinding } from "./binding/split-binding.js";
import { Builder } from "./building/builder.js";
import type { Component } from "./component.js";
import { ListRegion } from "./flow/list-region.js";
import { SwitchRegion } from "./flow/switch-region.js";
import type { INodePort } from "./i-node-port.js";
import { Prop } from "./prop.js";
import { RenderedView } from "./rendering/rendered-view.js";

export class View {
  private constructor() { }

  static bindComputeApply<T>(compute: () => T, apply: (obj: T) => void): IDisposable {
    let $__r: any;
    Builder.rejectBindingInPropsLambda();

    return Reactivity.effect(compute, ($__r = new SplitBinding(apply), $__r.apply.bind($__r)));
  }

  static bindWrite(write: () => void): IDisposable {
    Builder.rejectBindingInPropsLambda();

    return FusedBinding.start(write);
  }

  static bind<T>(compute: () => T, apply: (obj: T) => void): IDisposable;
  static bind(write: () => void): IDisposable;
  static bind(...args: unknown[]): any {
    if (args.length === 2 && typeof args[0] === "function" && typeof args[1] === "function") {
      return View.bindComputeApply(args[0] as any, args[1] as any);
    }

    if (args.length === 1 && typeof args[0] === "function") {
      return View.bindWrite(args[0] as () => void);
    }

    throw new Error("No matching overload for bind");
  }

  static live<T>(read: () => T): Prop<T> {
    return Prop.reading(read);
  }

  static textString(value: string): void {
    Builder.add(Builder.target.port.createText(value));
  }

  static textFuncOfString(value: () => string): void {
    const port = Builder.target.port;
    const node = port.createText("");
    Builder.add(node);
    FusedBinding.start(() => port.setText(node, value()));
  }

  static text(value: string): void;
  static text(value: () => string): void;
  static text(...args: unknown[]): void {
    if (args.length === 1 && isString(args[0])) {
      View.textString(args[0] as string);

      return;
    }

    if (args.length === 1 && typeof args[0] === "function") {
      View.textFuncOfString(args[0] as () => string);

      return;
    }

    throw new Error("No matching overload for text");
  }

  static forItemsKeyRender<T, TKey>(items: () => IReadOnlyList<T>, key: (arg: T) => TKey, render: (obj: T) => void): void {
    ListRegion.start(items, key, render);
  }

  static forItemsRender<T>(items: () => IReadOnlyList<T>, render: (obj: T) => void): void {
    ListRegion.start(items, (item: T) => item, render);
  }

  static for<T, TKey>(items: () => IReadOnlyList<T>, key: (arg: T) => TKey, render: (obj: T) => void): void;
  static for<T>(items: () => IReadOnlyList<T>, render: (obj: T) => void): void;
  static for(...args: unknown[]): any {
    if (args.length === 3 && typeof args[0] === "function" && typeof args[1] === "function" && typeof args[2] === "function") {
      View.forItemsKeyRender(args[0] as any, args[1] as any, args[2] as any);

      return;
    }

    if (args.length === 2 && typeof args[0] === "function" && typeof args[1] === "function") {
      View.forItemsRender(args[0] as any, args[1] as any);

      return;
    }

    throw new Error("No matching overload for for");
  }

  static show(when: () => boolean, then: () => void, otherwise: (() => void) | null = null): void {
    SwitchRegion.start(when, then, otherwise);
  }

  static mount<TComponent extends Component<TComponent>>(component: TComponent, build: (obj: TComponent) => void): void {
    Builder.runRejectingChildren(build, component);
    component.render();
  }

  static render(build: () => void, container: Object, port: INodePort): IDisposable {
    return RenderedView.start(build, container, port);
  }
}
