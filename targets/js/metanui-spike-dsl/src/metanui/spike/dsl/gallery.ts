import { Reactivity } from "metanui-reactive/metanui/reactive";
import { MicrotaskScheduler } from "metanui-spike-counter/metanui/spike/counter/ui";
import { AttributeListVariant } from "./variants/attribute-list-variant.js";
import { BuilderVariant } from "./variants/builder/builder-variant.js";
import { CardGUsage } from "./variants/builder/card-g-usage.js";
import { CardCUsage } from "./variants/components/card-c-usage.js";
import { CounterList } from "./variants/direct/counter-list.js";
import { Counter } from "./variants/direct/counter.js";
import { DirectUsage } from "./variants/direct/direct-usage.js";
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
      CardCUsage.cards().attachTo(body);
      CardGUsage.cards().attachTo(body);
      DirectUsage.gallery().attachTo(body);
      Counter.create((counter: Counter) => counter.label = "Solo").attachTo(body);
      CounterList.create((list: CounterList) => {
      }).attachTo(body);
    });
  }
}
