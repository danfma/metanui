import { implementsInterface, type InterfaceType } from "metano-runtime";

export interface INodePort {
  createText(text: string): Object;
  setText(text: Object, value: string): void;
  createAnchor(): Object;
  insert(parent: Object, node: Object, anchor: Object | null): void;
  remove(parent: Object, node: Object): void;
}

export const INodePort$runtimeType: InterfaceType<INodePort> = {
  kind: "interface",
  name: "INodePort",
  fullName: "Metanui.Ui.INodePort",
  namespace: "Metanui.Ui",
  baseInterfaces: [],
  plainImplementers: [],
  test: (v: unknown): v is INodePort => implementsInterface(v, INodePort$runtimeType),
};
