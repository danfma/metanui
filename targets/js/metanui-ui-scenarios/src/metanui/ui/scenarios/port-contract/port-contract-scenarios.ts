import { Scenario, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import type { INodePort } from "metanui-ui/metanui/ui";
import type { INodePortProbe } from "./i-node-port-probe.js";

export class PortContractScenarios {
  private constructor() { }

  static for(platform: string, createPort: () => INodePort, probe: INodePortProbe): Scenario[] {
    return [new Scenario(`${platform} port: text is created and replaced`, (expect: IExpect) => PortContractScenarios.textIsCreatedAndReplaced(expect, createPort(), probe)), new Scenario(`${platform} port: an anchor is a placeholder child`, (expect: IExpect) => PortContractScenarios.anAnchorIsAPlaceholderChild(expect, createPort(), probe)), new Scenario(`${platform} port: a null anchor appends`, (expect: IExpect) => PortContractScenarios.aNullAnchorAppends(expect, createPort(), probe)), new Scenario(`${platform} port: insert goes before the anchor`, (expect: IExpect) => PortContractScenarios.insertGoesBeforeTheAnchor(expect, createPort(), probe)), new Scenario(`${platform} port: an existing child is moved before the anchor`, (expect: IExpect) => PortContractScenarios.anExistingChildIsMovedBeforeTheAnchor(expect, createPort(), probe)), new Scenario(`${platform} port: an existing child is moved last by a null anchor`, (expect: IExpect) => PortContractScenarios.anExistingChildIsMovedLastByANullAnchor(expect, createPort(), probe)), new Scenario(`${platform} port: remove takes the child out`, (expect: IExpect) => PortContractScenarios.removeTakesTheChildOut(expect, createPort(), probe))];
  }

  private static textIsCreatedAndReplaced(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const text = port.createText("a");
    expect.equal("a", probe.textOf(text), "created");
    port.setText(text, "b");
    expect.equal("b", probe.textOf(text), "replaced");
  }

  private static anAnchorIsAPlaceholderChild(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = probe.createParent();
    const anchor = port.createAnchor();
    port.insert(parent, anchor, null);
    expect.isTrue(probe.isAnchor(anchor), "is anchor");
    expect.isTrue(!probe.isAnchor(port.createText("a")), "text is not an anchor");
    expect.equal("^", PortContractScenarios.print(probe, parent), "children");
  }

  private static aNullAnchorAppends(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = PortContractScenarios.parentWith(port, probe, "a", "b");
    port.insert(parent, port.createText("c"), null);
    expect.equal("a b c", PortContractScenarios.print(probe, parent), "children");
  }

  private static insertGoesBeforeTheAnchor(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = probe.createParent();
    const anchor = port.createAnchor();
    port.insert(parent, anchor, null);
    port.insert(parent, port.createText("a"), anchor);
    port.insert(parent, port.createText("b"), anchor);
    expect.equal("a b ^", PortContractScenarios.print(probe, parent), "children");
  }

  private static anExistingChildIsMovedBeforeTheAnchor(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = PortContractScenarios.parentWith(port, probe, "a", "b", "c");
    port.insert(parent, probe.childAt(parent, 2), probe.childAt(parent, 0));
    expect.equal("c a b", PortContractScenarios.print(probe, parent), "children");
  }

  private static anExistingChildIsMovedLastByANullAnchor(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = PortContractScenarios.parentWith(port, probe, "a", "b", "c");
    port.insert(parent, probe.childAt(parent, 0), null);
    expect.equal("b c a", PortContractScenarios.print(probe, parent), "children");
  }

  private static removeTakesTheChildOut(expect: IExpect, port: INodePort, probe: INodePortProbe): void {
    const parent = PortContractScenarios.parentWith(port, probe, "a", "b", "c");
    port.remove(parent, probe.childAt(parent, 1));
    expect.equal("a c", PortContractScenarios.print(probe, parent), "children");
  }

  private static parentWith(port: INodePort, probe: INodePortProbe, ...texts: string[]): Object {
    const parent = probe.createParent();
    for (const text of texts) {
      port.insert(parent, port.createText(text), null);
    }

    return parent;
  }

  private static print(probe: INodePortProbe, parent: Object): string {
    let printed = "";
    for (let index = 0; index < probe.childCount(parent); index++) {
      const child = probe.childAt(parent, index);
      const part = probe.isAnchor(child) ? "^" : probe.textOf(child);
      printed = printed.length === 0 ? part : `${printed ?? ""} ${part ?? ""}`;
    }

    return printed;
  }
}
