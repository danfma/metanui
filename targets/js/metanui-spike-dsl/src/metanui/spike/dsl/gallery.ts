import { Reactivity } from "metanui-reactive/metanui/reactive";
import { MicrotaskScheduler } from "metanui-spike-counter/metanui/spike/counter/ui";
import { AttributeListVariant } from "./variants/attribute-list-variant.js";
import { BuilderVariant } from "./variants/builder/builder-variant.js";
import { FluentVariant } from "./variants/fluent-variant.js";
import { GroupedBindCounter } from "./variants/grouped-bind-counter.js";
import { CollectionInitializerVariant } from "./variants/initializers/collection-initializer-variant.js";
import { RecordPropsVariant } from "./variants/record-props-variant.js";

export class Gallery {
  private constructor() { }

  static main(): void {
    Reactivity.useScheduler(new MicrotaskScheduler());
    Reactivity.rootVoid((dispose: () => void) => {
      const body = document.body;
      RecordPropsVariant.counter().attachTo(body);
      AttributeListVariant.counter().attachTo(body);
      CollectionInitializerVariant.counter().attachTo(body);
      FluentVariant.counter().attachTo(body);
      new GroupedBindCounter().attachTo(body);
      BuilderVariant.counter().attachTo(body);
    });
  }
}
