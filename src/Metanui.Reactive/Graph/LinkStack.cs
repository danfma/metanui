using Metano.Annotations;

namespace Metanui.Reactive.Graph;

/// <summary>
/// Frame of the explicit stack <see cref="DependencyGraph" /> keeps while it walks branching
/// paths of the graph (alien-signals <c>Stack&lt;T&gt;</c>); allocated only at a branch.
/// </summary>
[Transpile]
internal sealed class LinkStack(Link? value, LinkStack? prev)
{
    public readonly Link? Value = value;
    public readonly LinkStack? Prev = prev;
}
