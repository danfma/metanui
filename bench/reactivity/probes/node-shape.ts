// F2: builds 100,000 Metanui signals against hand-written classes of the same three-level shape.
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { formatSampled, sampleMs } from "./sampling.ts";

// The probe compares class layouts, so unlike application code it declares classes.
class AssignedNode {
  deps: unknown;
  depsTail: unknown;
  subs: unknown;
  subsTail: unknown;
  flags: number;

  constructor() {
    this.deps = null;
    this.depsTail = null;
    this.subs = null;
    this.subsTail = null;
    this.flags = 0;
  }
}

class AssignedSignalNode extends AssignedNode {
  nextPending: unknown;

  constructor() {
    super();
    this.nextPending = null;
  }
}

class AssignedSignal extends AssignedSignalNode {
  comparer: unknown;
  value: unknown;
  pending: unknown;
  hasPending: boolean;

  constructor(value: unknown) {
    super();
    this.hasPending = false;
    this.comparer = null;
    this.value = value;
    this.pending = value;
    this.flags = 1;
  }
}

class FieldNode {
  deps = null;
  depsTail = null;
  subs = null;
  subsTail = null;
  flags = 0;
}

class FieldSignalNode extends FieldNode {
  nextPending = null;
}

class FieldSignal extends FieldSignalNode {
  hasPending = false;
  comparer: unknown = null;
  value: unknown;
  pending: unknown;

  constructor(value: unknown) {
    super();
    this.value = value;
    this.pending = value;
    this.flags = 1;
  }
}

const count = 100_000;
const kept: unknown[] = new Array(count);

const builders: Record<string, (index: number) => unknown> = {
  "Reactivity.signal": (index) => Reactivity.signal(index),
  "class fields": (index) => new FieldSignal(index),
  "constructor assignments": (index) => new AssignedSignal(index),
};

for (const [label, build] of Object.entries(builders)) {
  const sampled = sampleMs(30, () => {
    for (let index = 0; index < count; index++) {
      kept[index] = build(index);
    }
  });

  console.log(formatSampled(label, sampled));
}
