import type { INodePort } from "../i-node-port.js";

export abstract class Region {
  declare protected readonly port: INodePort;
  declare protected readonly parent: Object;

  /** @internal */
  abstract readonly firstNode: Object | null;

  constructor(port: INodePort, parent: Object) {
    this.port = port;
    this.parent = parent;
  }

  /** @internal */
  abstract moveBefore(anchor: Object | null): void;
}
