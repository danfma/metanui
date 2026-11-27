using Metanui.Ui.Regions;

namespace Metanui.Ui.Building;

/// <summary>
/// The ambient insertion point that builder lambdas build into: a port, a parent, the node to
/// insert before (null for last) and the region that records the top-level nodes. Platform element
/// factories use <see cref="Create{TNode}" /> and <see cref="Add" />; every change of the scope is
/// restored in <c>finally</c>.
/// </summary>
/// <remarks>
/// The scope is process-wide static state, like the reactive core's tracking state: building runs
/// on one thread.
/// </remarks>
public static class Builder
{
    private const string NoBuilderMessage =
        "No builder is active: create nodes inside View.Render or inside an element's builder.";

    private const string ChildrenGoInContentMessage =
        "Children go in Content: a component's props lambda only sets props; assign the children to Content.";

    private static readonly Action<Action> InvokeBody = static body => body();

    private static INodePort? _port;
    private static object? _parent;
    private static object? _before;
    private static Fragment? _collector;
    private static string? _rejection;

    /// <summary>The port of the active scope.</summary>
    /// <exception cref="InvalidOperationException">No builder is active.</exception>
    internal static INodePort Port
    {
        get
        {
            RequireParent();

            return _port!;
        }
    }

    /// <summary>The parent of the active scope.</summary>
    /// <exception cref="InvalidOperationException">No builder is active.</exception>
    internal static object Parent => RequireParent();

    /// <summary>
    /// Runs <paramref name="build" /> with <paramref name="node" /> as the parent of what it creates,
    /// then inserts <paramref name="node" />, built, at the ambient insertion point.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// No builder is active, or the call runs in a component's props lambda.
    /// </exception>
    public static void Create<TNode>(TNode node, Action<TNode> build)
        where TNode : class
    {
        var parent = RequireParent();
        var port = _port!;
        var before = _before;
        var collector = _collector;

        Run(port, node, null, null, null, build, node);
        port.Insert(parent, node, before);
        collector?.Add(node);
    }

    /// <summary>Inserts a leaf node at the ambient insertion point.</summary>
    /// <exception cref="InvalidOperationException">
    /// No builder is active, or the call runs in a component's props lambda.
    /// </exception>
    public static void Add(object node)
    {
        var parent = RequireParent();

        _port!.Insert(parent, node, _before);
        _collector?.Add(node);
    }

    /// <summary>
    /// Inserts the end anchor of <paramref name="region" /> at the ambient insertion point and records
    /// the region, so a region around it moves the nodes the region holds at that time.
    /// </summary>
    internal static void AddRegion(Region region, object end)
    {
        var parent = RequireParent();

        _port!.Insert(parent, end, _before);
        _collector?.Add(region);
    }

    /// <summary>
    /// Runs <paramref name="body" /> building into <paramref name="parent" /> before
    /// <paramref name="before" />, recording its top-level nodes in <paramref name="collector" />.
    /// </summary>
    internal static void Run(
        INodePort port,
        object parent,
        object? before,
        Fragment? collector,
        Action body
    ) => Run(port, parent, before, collector, null, InvokeBody, body);

    /// <inheritdoc cref="Run(INodePort, object, object?, Fragment?, Action)" />
    internal static void Run<T>(
        INodePort port,
        object parent,
        object? before,
        Fragment? collector,
        Action<T> body,
        T argument
    ) => Run(port, parent, before, collector, null, body, argument);

    /// <summary>
    /// Runs a component's props lambda: every node created there is rejected with a message that
    /// points to <c>Content</c>.
    /// </summary>
    internal static void RunRejectingChildren<T>(Action<T> body, T argument) =>
        Run(_port, null, null, null, ChildrenGoInContentMessage, body, argument);

    private static void Run<T>(
        INodePort? port,
        object? parent,
        object? before,
        Fragment? collector,
        string? rejection,
        Action<T> body,
        T argument
    )
    {
        var savedPort = _port;
        var savedParent = _parent;
        var savedBefore = _before;
        var savedCollector = _collector;
        var savedRejection = _rejection;

        _port = port;
        _parent = parent;
        _before = before;
        _collector = collector;
        _rejection = rejection;

        try
        {
            body(argument);
        }
        finally
        {
            _port = savedPort;
            _parent = savedParent;
            _before = savedBefore;
            _collector = savedCollector;
            _rejection = savedRejection;
        }
    }

    private static object RequireParent() =>
        _parent ?? throw new InvalidOperationException(_rejection ?? NoBuilderMessage);
}
