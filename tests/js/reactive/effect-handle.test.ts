import { expect, test } from "bun:test";
import { IDisposable$runtimeType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";

// Hand-written TS uses the effect handle that `Reactivity.Effect` returns
// (docs/design/0001-reactive-core.md, section 4.3) through the Metano 4 `IDisposable` contract:
// native `using` and the nominal runtime type test.

function recordEffect(source: { readonly value: number }, appliedValues: number[]) {
  return Reactivity.effect(
    () => source.value,
    (value: number) => {
      appliedValues.push(value);
    },
  );
}

test("an effect that is not disposed keeps applying", () => {
  const source = Reactivity.signal(0);
  const appliedValues: number[] = [];

  const handle = recordEffect(source, appliedValues);

  Reactivity.flush();
  source.value = 1;
  Reactivity.flush();

  expect(appliedValues).toEqual([0, 1]);

  handle.dispose();
});

test("a using declaration disposes the effect at the end of its scope", () => {
  const source = Reactivity.signal(0);
  const appliedValues: number[] = [];

  {
    using _effectHandle = recordEffect(source, appliedValues);

    Reactivity.flush();
  }

  source.value = 1;
  Reactivity.flush();

  expect(appliedValues).toEqual([0]);
});

test("disposing through Symbol.dispose and then dispose runs the disposal once", () => {
  const source = Reactivity.signal(0);
  const appliedValues: number[] = [];
  const handle = recordEffect(source, appliedValues);

  Reactivity.flush();
  handle[Symbol.dispose]();
  handle.dispose();
  source.value = 1;
  Reactivity.flush();

  expect(appliedValues).toEqual([0]);
});

test("the effect handle passes the nominal IDisposable test", () => {
  using handle = recordEffect(Reactivity.signal(0), []);

  expect(IDisposable$runtimeType.test(handle)).toBe(true);
});
