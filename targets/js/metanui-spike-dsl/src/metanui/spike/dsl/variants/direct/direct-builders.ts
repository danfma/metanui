import { Dictionary, HashSet, throwModified, type IReadOnlyList } from "metano-runtime/system/collections";
import { throwError } from "metano-runtime";
import { linq, toList, where } from "metano-runtime/system/linq";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { El } from "../../core/el.js";
import type { Part } from "../../core/part.js";
import type { Component } from "./component.js";
import { ItemView } from "./item-view.js";

export class DirectBuilders {
  private static _current: HTMLElement | null = null;

  private constructor() { }

  static section(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("section", build);
  }

  static div(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("div", build);
  }

  static h2(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("h2", build);
  }

  static p(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("p", build);
  }

  static button(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("button", build);
  }

  static span(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("span", build);
  }

  static for<T>(items: () => IReadOnlyList<T>, key: (arg: T) => number, render: (arg: T) => El): El {
    return DirectBuilders.create("div", (host) => {
      const views = new Dictionary<number, ItemView>();
      Reactivity.effect(() => {
        const list = items();

        return Reactivity.untrack(() => {
          DirectBuilders.reconcile(host, views, list, key, render);

          return list.count;
        });
      }, (count: number, previous: number) => {
      });
    });
  }

  static add(part: Part): void {
    part.attachTo(DirectBuilders._current ?? throwError(new InvalidOperationException("Add runs only inside an element builder.")));
  }

  static mount<TComponent extends Component<TComponent>>(component: TComponent, build: (obj: TComponent) => void): El {
    const parent = DirectBuilders._current;
    const content = document.createElement("div");
    DirectBuilders._current = content;
    try {
      build(component);
    } finally {
      DirectBuilders._current = null;
    }
    try {
      const root = component.render(new El(content));
      parent?.appendChild(root.node);

      return root;
    } finally {
      DirectBuilders._current = parent;
    }
  }

  private static reconcile<T>(host: HTMLElement, views: Dictionary<number, ItemView>, list: IReadOnlyList<T>, key: (arg: T) => number, render: (arg: T) => El): void {
    const kept = new HashSet<number>();
    for (const item of list) {
      kept.add(key(item));
    }
    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = linq(views.keys, where((id: number) => !kept.contains(id)), toList());
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const stale = $a[$i]!;
        let view = views.get(stale);
        views.remove(stale);
        host.removeChild(view.node);
        view.dispose();
      }
    }
    for (const item of list) {
      const id = key(item);
      let [$found0, view] = views.tryGetValue(id, null);

      if (!$found0) {
        view = DirectBuilders.renderItem(item, render);
        views.set(id, view);
      }

      host.appendChild(view.node);
    }
  }

  private static renderItem<T>(item: T, render: (arg: T) => El): ItemView {
    return Reactivity.rootBody<ItemView>((dispose: () => void) => {
      const parent = DirectBuilders._current;
      DirectBuilders._current = null;
      try {
        return new ItemView(render(item).node, dispose);
      } finally {
        DirectBuilders._current = parent;
      }
    });
  }

  private static create(tagName: string, build: (obj: HTMLElement) => void): El {
    const node = document.createElement(tagName);
    const parent = DirectBuilders._current;
    DirectBuilders._current = node;
    try {
      build(node);
    } finally {
      DirectBuilders._current = parent;
    }
    parent?.appendChild(node);

    return new El(node);
  }
}
