namespace Metanui.Reactive.Graph;

/// <summary>A vertex of the dependency graph; public only so the public primitives can derive from it.</summary>
public abstract class ReactiveNode
{
    internal Link? Deps;
    internal Link? DepsTail;
    internal Link? Subs;
    internal Link? SubsTail;
    internal ReactiveFlags Flags;

    /// <summary>Recomputes the node and reports whether its value changed.</summary>
    internal abstract bool Update();

    /// <summary>Called when a watched node is reached by propagation.</summary>
    internal abstract void Notify();

    /// <summary>Called when the last subscriber is gone.</summary>
    internal virtual void Unwatched() { }
}
