import { expect, test } from "bun:test";
import { Reactivity } from "metanui-reactive/metanui/reactive";

// Hand-written TS reaches both C# `Root` overloads through one `root` dispatcher, which must not
// depend on the callback's declared arity (danfma/metano#778).

test("root accepts a callback that ignores the disposer", () => {
  const value = Reactivity.root(() => 42);

  expect(value).toBe(42);
});

test("root hands the disposer to a callback that takes it", () => {
  const source = Reactivity.signal(0);
  const applied: number[] = [];

  const dispose = Reactivity.root((disposeRoot: () => void) => {
    Reactivity.effect(
      () => source.value,
      (value: number) => {
        applied.push(value);
      },
    );

    return disposeRoot;
  });

  Reactivity.flush();
  dispose();
  source.value = 1;
  Reactivity.flush();

  expect(applied).toEqual([0]);
});
