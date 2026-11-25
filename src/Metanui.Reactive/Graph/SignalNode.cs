namespace Metanui.Reactive.Graph;

/// <summary>Graph node of a signal: carries a pending write until the flush commits it.</summary>
public abstract class SignalNode : ReactiveNode
{
    /// <summary>Next signal with a pending write in the flush queue.</summary>
    internal SignalNode? NextPending;

    /// <summary>Commits the pending write, if it differs from the committed value.</summary>
    internal abstract void CommitPending();

    /// <summary>Signals are never notified: they are sources, not subscribers.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A signal cannot be notified.");
}
