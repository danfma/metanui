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

    public Signal(T initialValue, IEqualityComparer<T>? comparer = null)
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
            RejectWriteInsideComputation();
            _pending = value;
            Queue();
        }
    }

    // Metano #768: the import of a type referenced only inside a property setter body is not emitted
    private void Queue()
    {
        if (!_hasPending)
        {
            _hasPending = true;
            FlushLoop.Enqueue(this);
        }

        // Requested on every write, not only the first: if the scheduler threw, the write stayed
        // queued with no flush scheduled, and a later write must schedule it.
        FlushLoop.RequestFlush();
    }

    // Metano #768: same missing import, for RootNode and InvalidOperationException
    /// <summary>
    /// Solid 2.0.4 rejects a write while the current owner is a computation, tracked or not (inside
    /// <see cref="Reactivity.Untrack{T}" /> too). A root body and an apply are not computations.
    /// </summary>
    private static void RejectWriteInsideComputation()
    {
        var owner = Tracking.CurrentOwner;

        if (owner is not null && owner is not RootNode)
        {
            throw new InvalidOperationException(WriteInsideComputationMessage);
        }
    }

    /// <summary>Reads the committed value without subscribing the current observer.</summary>
    public T Peek() => _value;

    /// <summary>Commits the pending value, if any, and reports whether the committed value changed.</summary>
    internal override bool Update()
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
