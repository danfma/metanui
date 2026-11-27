using Metanui.Ui.Regions;

namespace Metanui.Ui.Building;

/// <summary>
/// The state of the builder: the insertion point while building, or none together with the message
/// that explains why nothing can be built here. <paramref name="InPropsLambda" /> marks a
/// component's props lambda, where a binding is rejected too.
/// </summary>
internal readonly record struct Scope(InsertionPoint? Target, string Rejection, bool InPropsLambda)
{
    private const string NoBuilderMessage =
        "No builder is active: create nodes inside View.Render or inside an element's builder.";

    private const string ChildrenGoInContentMessage =
        "Children go in Content: a component's props lambda only sets props; assign the children to Content.";

    private const string BindingInPropsLambdaMessage =
        "A binding in a component's props lambda is lost: Render reads the props once. Assign View.Live(() => ...) to the prop instead.";

    /// <summary>Outside every builder.</summary>
    public static readonly Scope None = new(null, NoBuilderMessage, false);

    /// <summary>Inside a component's props lambda: a node created there belongs in <c>Content</c>.</summary>
    public static readonly Scope RejectingChildren = new(null, ChildrenGoInContentMessage, true);

    /// <summary>Building into <paramref name="parent" /> before <paramref name="before" />.</summary>
    public static Scope Building(
        INodePort port,
        object parent,
        object? before,
        Fragment? collector
    ) => new(new InsertionPoint(port, parent, before, collector), NoBuilderMessage, false);

    /// <summary>The insertion point.</summary>
    /// <exception cref="InvalidOperationException">
    /// There is none; the message says why (a <c>default</c> scope reports that no builder is active).
    /// </exception>
    public InsertionPoint Require() =>
        Target ?? throw new InvalidOperationException(Rejection ?? NoBuilderMessage);

    /// <summary>Rejects a binding in a component's props lambda.</summary>
    /// <exception cref="InvalidOperationException">This is a props lambda.</exception>
    public void RejectBinding()
    {
        if (InPropsLambda)
        {
            throw new InvalidOperationException(BindingInPropsLambdaMessage);
        }
    }
}
