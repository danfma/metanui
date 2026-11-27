import { afterAll, expect, test } from "bun:test";
import { defaultEquals } from "metano-runtime";
import { type IExpect, ScenarioRunner } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import {
  type INodePortProbe,
  PortContractScenarios,
} from "metanui-ui-scenarios/metanui/ui/scenarios/port-contract";
import { DomNodePort } from "metanui-ui-web/metanui/ui/web";
import { type FakeNode, installFakeDocument } from "./fake-dom.ts";

// The INodePort contract scenarios of Metanui.Ui.Scenarios, run against DomNodePort on the fake DOM.

const fakeDocument = installFakeDocument();

const node = (handle: unknown) => handle as FakeNode;

const domProbe: INodePortProbe = {
  createParent: () => fakeDocument.document.createElement("div"),
  childCount: (parent: unknown) => node(parent).childNodes.length,
  childAt: (parent: unknown, index: number) => node(parent).childNodes[index],
  isAnchor: (candidate: unknown) => node(candidate).nodeName === "#comment",
  textOf: (text: unknown) => node(text).data,
};

// The same IExpect adapter as tests/js/ui (shared test support is deferred until it is worth a package).
const bunExpect: IExpect = {
  equal<T>(expected: T, actual: T, label: string): void {
    const message = `${label}: expected ${Bun.inspect(expected)}, got ${Bun.inspect(actual)}`;

    expect(defaultEquals(expected, actual), message).toBe(true);
  },

  isTrue(condition: boolean, label: string): void {
    expect(condition, label).toBe(true);
  },
};

afterAll(() => {
  fakeDocument.uninstall();
});

for (const scenario of PortContractScenarios.for("dom", () => new DomNodePort(), domProbe)) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
