using Metanui.Ui.Regions;

namespace Metanui.Ui.Building;

/// <summary>
/// The state of the builder: the insertion point while building, or none together with the message
/// that explains why nothing can be built here.
/// </summary>
internal readonly record struct Scope(InsertionPoint? Target, string Rejection)
{
    private const string NoBuilderMessage =
        "No builder is active: create nodes inside View.Render or inside an element's builder.";

    private const string ChildrenGoInContentMessage =
        "Children go in Content: a component's props lambda only sets props; assign the children to Content.";

    /// <summary>Outside every builder.</summary>
    public static readonly Scope None = new(null, NoBuilderMessage);

    /// <summary>Inside a component's props lambda: a node created there belongs in <c>Content</c>.</summary>
    public static readonly Scope RejectingChildren = new(null, ChildrenGoInContentMessage);

    /// <summary>Building into <paramref name="parent" /> before <paramref name="before" />.</summary>
    public static Scope Building(
        INodePort port,
        object parent,
        object? before,
        Fragment? collector
    ) => new(new InsertionPoint(port, parent, before, collector), NoBuilderMessage);

    /// <summary>The insertion point.</summary>
    /// <exception cref="InvalidOperationException">There is none; the message says why.</exception>
    public InsertionPoint Require() => Target ?? throw new InvalidOperationException(Rejection);
}
