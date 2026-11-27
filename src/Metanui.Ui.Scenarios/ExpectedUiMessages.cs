namespace Metanui.Ui.Scenarios;

/// <summary>Messages of the UI layer's exceptions the scenarios assert on.</summary>
public static class ExpectedUiMessages
{
    public const string NoBuilder =
        "No builder is active: create nodes inside View.Render or inside an element's builder.";

    public const string ChildrenGoInContent =
        "Children go in Content: a component's props lambda only sets props; assign the children to Content.";

    public const string SignalWriteInComputation =
        "Writing to a signal inside a computation is not allowed; move the write outside.";
}
