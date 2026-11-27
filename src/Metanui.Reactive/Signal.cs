namespace Metanui.Reactive;

/// <summary>
/// A reactive value cell. Writes are queued and only become visible when the flush commits them.
/// </summary>
public sealed class Signal<T> : SignalNode
{
    private const string WriteInsideComputationMessage =
        "Writing to a signal inside a computation is not allowed; move the write outside.";

    private readonly IEqualityComparer<T> _comparer;
    private T _value;
    private T _pending;
    private bool _hasPending;

    internal Signal(T initialValue, IEqualityComparer<T>? comparer = null)
    {
        _comparer = comparer ?? EqualityComparer<T>.Default;
        _value = initialValue;
        _pending = initialValue;
        Flags = ReactiveFlags.Mutable;
    }

    /// <summary>
    /// Get: the committed value; inside a tracking scope, also subscribes the current observer.
    /// Set: queues a pending write, committed by the next flush.
    /// </summary>
    public T Value
    {
        get
        {
            var observer = Tracking.ActiveObserver;

            if (observer is not null)
            {
                DependencyGraph.Link(this, observer, Tracking.Cycle);
            }

            return _value;
        }
        set
        {
            if (Tracking.CurrentOwner is not null)
            {
                RejectWriteInsideComputation();
            }

            QueueWrite(value);
        }
    }

    /// <summary>
    /// Writes <c>update(latest)</c>: <c>latest</c> is the pending value when a write is queued and not
    /// yet committed, the committed value otherwise, so several updates in one tick chain.
    /// </summary>
    public void Update(Func<T, T> update)
    {
        if (Tracking.CurrentOwner is not null)
        {
            RejectWriteInsideComputation();
        }

        QueueWrite(update(_hasPending ? _pending : _value));
    }

    private void QueueWrite(T value)
    {
        _pending = value;

        if (!_hasPending)
        {
            _hasPending = true;
            FlushLoop.Enqueue(this);
        }

        // Requested on every write, not only the first: if the scheduler threw, the write
        // stayed queued with no flush scheduled, and a later write must schedule it.
        FlushLoop.RequestFlush();
    }

    /// <summary>
    /// Solid 2.0.4 rejects a write while the current owner is a computation, tracked or not (inside
    /// <see cref="Reactivity.Untrack{T}" /> too), or a root created under one. A root outside every
    /// computation and an apply (no owner) allow writes, and so does a cleanup run by a disposal
    /// (Solid <c>disposalDepth</c>). Called only when there is an owner.
    /// </summary>
    /// <remarks>
    /// Kept out of line on purpose: the cold rejection path (RootNode, Teardown and the throw) stays
    /// out of the setter, which every write runs.
    /// </remarks>
    private static void RejectWriteInsideComputation()
    {
        if (Teardown.Depth != 0)
        {
            return;
        }

        if (Tracking.CurrentOwner is not RootNode root || root.UnderComputation)
        {
            throw new InvalidOperationException(WriteInsideComputationMessage);
        }
    }

    /// <summary>Reads the committed value without subscribing the current observer.</summary>
    public T Peek() => _value;

    /// <summary>Commits the pending value, if any, and reports whether the committed value changed.</summary>
    internal override bool Refresh()
    {
        if (!_hasPending)
        {
            return false;
        }

        _hasPending = false;

        if (_comparer.Equals(_value, _pending))
        {
            return false;
        }

        _value = _pending;

        return true;
    }

    internal override void DiscardPending()
    {
        _hasPending = false;
        _pending = _value;
    }
}
