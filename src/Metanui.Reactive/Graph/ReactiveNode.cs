namespace Metanui.Reactive.Graph;

/// <summary>A vertex of the dependency graph; public only so the public primitives can derive from it.</summary>
public abstract class ReactiveNode
{
    internal Link? Deps;
    internal Link? DepsTail;
    internal Link? Subs;
    internal Link? SubsTail;
    internal ReactiveFlags Flags;

    // Metano (reported 2026-11-27, issue number pending): an override and a same-named overload emit
    // duplicate TS members. Kept as Refresh after the fix: Update is Signal<T>'s public write API.

    /// <summary>
    /// Brings the node up to date (a signal commits its pending write, a computed recomputes) and
    /// reports whether its value changed.
    /// </summary>
    internal abstract bool Refresh();

    /// <summary>Called when a watched node is reached by propagation.</summary>
    internal abstract void Notify();

    /// <summary>Called when the last subscriber is gone.</summary>
    internal virtual void Unwatched() { }
}
