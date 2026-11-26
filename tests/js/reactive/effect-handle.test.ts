import { expect, test } from "bun:test";
import { IDisposable$runtimeType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";

// Hand-written TS uses the effect handle that `Reactivity.Effect` returns (spec 4.3) through the
// Metano 4 `IDisposable` contract: native `using` and the nominal runtime type test.

test("a using declaration disposes the effect at the end of its scope", () => {
  const source = Reactivity.signal(0);
  const applied: number[] = [];

  {
    using _handle = Reactivity.effect(
      () => source.value,
      (value: number) => {
        applied.push(value);
      },
    );

    Reactivity.flush();
  }

  source.value = 1;
  Reactivity.flush();

  expect(applied).toEqual([0]);
});

test("the effect handle passes the nominal IDisposable test", () => {
  const handle = Reactivity.effect(
    () => 0,
    () => {},
  );

  expect(IDisposable$runtimeType.test(handle)).toBe(true);

  handle.dispose();
});
