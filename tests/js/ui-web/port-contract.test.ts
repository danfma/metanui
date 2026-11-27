import { afterAll, test } from "bun:test";
import { type FakeNode, installFakeDocument } from "metanui-fake-dom";
import { ScenarioRunner } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { bunExpect } from "metanui-test-support";
import {
  type INodePortProbe,
  PortContractScenarios,
} from "metanui-ui-scenarios/metanui/ui/scenarios/port-contract";
import { DomNodePort } from "metanui-ui-web/metanui/ui/web";

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

afterAll(() => {
  fakeDocument.uninstall();
});

for (const scenario of PortContractScenarios.for("dom", () => new DomNodePort(), domProbe)) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
