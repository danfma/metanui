namespace Metanui.Ui.Scenarios;

/// <summary>Messages of the UI layer's exceptions the scenarios assert on.</summary>
public static class ExpectedUiMessages
{
    public const string NoBuilder =
        "No builder is active: create nodes inside View.Render or inside an element's builder.";

    public const string ChildrenGoInContent =
        "Children go in Content: a component's props lambda only sets props; assign the children to Content.";

    public const string BindingInPropsLambda =
        "A binding in a component's props lambda is lost: Render reads the props once. Assign View.Live(() => ...) to the prop instead.";

    public const string SignalWriteInComputation =
        "Writing to a signal inside a computation is not allowed; move the write outside.";
}
