export class ExpectedUiMessages {
  static readonly noBuilder: string = "No builder is active: create nodes inside View.Render or inside an element's builder.";
  static readonly childrenGoInContent: string = "Children go in Content: a component's props lambda only sets props; assign the children to Content.";
  static readonly bindingInPropsLambda: string = "A binding in a component's props lambda is lost: Render reads the props once. Assign View.Live(() => ...) to the prop instead.";
  static readonly signalWriteInComputation: string = "Writing to a signal inside a computation is not allowed; move the write outside.";

  private constructor() { }
}
