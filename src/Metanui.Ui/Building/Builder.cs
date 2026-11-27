using Metanui.Ui.Regions;

namespace Metanui.Ui.Building;

/// <summary>
/// The extension point for platform adapters: their element factories create the platform element
/// and hand it to <see cref="Create{TNode}" /> (or a leaf node to <see cref="Add" />), which builds
/// it into the ambient insertion point. The rest of the UI layer (<c>For</c>, <c>Show</c>,
/// components, <c>View.Render</c>) changes that insertion point through the internal members.
/// </summary>
/// <remarks>
/// The scope is process-wide static state, like the reactive core's tracking state: building runs
/// on one thread. Every change of the scope is restored in <c>finally</c>.
/// </remarks>
public static class Builder
{
    private static readonly Action<Action> InvokeBody = static body => body();

    private static Scope _current = Scope.None;

    /// <summary>The insertion point of the active builder.</summary>
    /// <exception cref="InvalidOperationException">
    /// No builder is active, or the call runs in a component's props lambda.
    /// </exception>
    internal static InsertionPoint Target => _current.Require();

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
        var target = Target;

        RunIn(Scope.Building(target.Port, node, null, null), build, node);
        target.Insert(node);
    }

    /// <summary>Inserts a leaf node at the ambient insertion point.</summary>
    /// <exception cref="InvalidOperationException">
    /// No builder is active, or the call runs in a component's props lambda.
    /// </exception>
    public static void Add(object node) => Target.Insert(node);

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
    ) => RunIn(Scope.Building(port, parent, before, collector), InvokeBody, body);

    /// <summary>
    /// <see cref="Run" /> with a body that takes <paramref name="argument" />, so the caller needs no
    /// closure.
    /// </summary>
    internal static void RunWith<T>(
        INodePort port,
        object parent,
        object? before,
        Fragment? collector,
        Action<T> body,
        T argument
    ) => RunIn(Scope.Building(port, parent, before, collector), body, argument);

    /// <summary>
    /// Runs a component's props lambda: every node created there is rejected with a message that
    /// points to <c>Content</c>.
    /// </summary>
    internal static void RunRejectingChildren<T>(Action<T> body, T argument) =>
        RunIn(Scope.RejectingChildren, body, argument);

    /// <summary>
    /// Rejects a binding in a component's props lambda, where <c>Render</c> would never see what it
    /// writes.
    /// </summary>
    /// <exception cref="InvalidOperationException">The call runs in a component's props lambda.</exception>
    internal static void RejectBindingInPropsLambda() => _current.RejectBinding();

    private static void RunIn<T>(Scope scope, Action<T> body, T argument)
    {
        var saved = _current;

        _current = scope;

        try
        {
            body(argument);
        }
        finally
        {
            _current = saved;
        }
    }
}
