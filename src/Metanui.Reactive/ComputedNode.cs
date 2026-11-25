namespace Metanui.Reactive;

/// <summary>
/// Owner node of a computed: the non-generic part of <see cref="Computed{T}" /> that the flush queue
/// of pending retries works with, as <see cref="SignalNode" /> is for signals. Public only so
/// <see cref="Computed{T}" /> can derive from it.
/// </summary>
public abstract class ComputedNode : OwnerNode
{
    /// <summary>Next computed in the flush queue of pending retries (see <see cref="FlushLoop.EnqueueRetry" />).</summary>
    internal ComputedNode? NextRetry;

    /// <summary>
    /// Runs the retry the flush took off its queue (spec 4.2, rule F-9) and reports whether the flush
    /// must propagate a change to the subscribers, as for a committed signal.
    /// </summary>
    internal abstract bool RetryAtPassStart();
}
