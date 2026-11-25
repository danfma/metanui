using Metano.Annotations;

namespace Metanui.Reactive.Ownership;

/// <summary>
/// An owner that is not a computation: it has no dependencies and never re-runs, so writing a signal
/// while it is the current owner is allowed, unless the root sits under a computation. Backs
/// <see cref="Reactivity.Root{T}" />.
/// </summary>
[Transpile]
internal sealed class RootNode : OwnerNode
{
    /// <summary>
    /// Whether a computation is among the root's owners, so a write in its body is still a write
    /// inside that computation. Fixed at creation: a root's owner chain never changes.
    /// </summary>
    internal readonly bool UnderComputation;

    internal RootNode() => UnderComputation = IsUnderComputation(Parent);

    /// <summary>
    /// Runs <paramref name="body" /> with this root as the current owner and no observer (a root body
    /// is untracked), handing it the disposer.
    /// </summary>
    internal T Run<T>(Func<Action, T> body)
    {
        var previousOwner = Tracking.CurrentOwner;
        var previousObserver = Tracking.ActiveObserver;

        Tracking.CurrentOwner = this;
        Tracking.ActiveObserver = null;

        try
        {
            return body(Dispose);
        }
        finally
        {
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveObserver = previousObserver;
        }
    }

    /// <summary>A root has no dependencies, so no dependency walk ever asks it to update.</summary>
    internal override bool Update() =>
        throw new InvalidOperationException("A root cannot be updated.");

    /// <summary>A root subscribes to nothing, so propagation never reaches it.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A root cannot be notified.");

    private static bool IsUnderComputation(OwnerNode? parent) =>
        parent is not null && (parent is not RootNode root || root.UnderComputation);
}
