namespace Metanui.Reactive.Graph;

/// <summary>
/// Graph node of a signal: carries a pending write until the flush commits it through
/// <see cref="ReactiveNode.Update" />.
/// </summary>
public abstract class SignalNode : ReactiveNode
{
    /// <summary>
    /// Next signal in the flush queue of pending writes; during a flush, next signal whose committed
    /// value changed.
    /// </summary>
    internal SignalNode? NextPending;

    /// <summary>Drops the pending write, if any, keeping the committed value.</summary>
    internal abstract void DiscardPending();

    /// <summary>Signals are never notified: they are sources, not subscribers.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A signal cannot be notified.");
}
