import { implementsInterface, type InterfaceType } from "metano-runtime";

export interface INodePortProbe {
  createParent(): Object;
  childCount(parent: Object): number;
  childAt(parent: Object, index: number): Object;
  isAnchor(node: Object): boolean;
  textOf(node: Object): string;
}

export const INodePortProbe$runtimeType: InterfaceType<INodePortProbe> = {
  kind: "interface",
  name: "INodePortProbe",
  fullName: "Metanui.Ui.Scenarios.PortContract.INodePortProbe",
  namespace: "Metanui.Ui.Scenarios.PortContract",
  baseInterfaces: [],
  plainImplementers: [],
  test: (v: unknown): v is INodePortProbe => implementsInterface(v, INodePortProbe$runtimeType),
};
