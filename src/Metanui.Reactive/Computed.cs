namespace Metanui.Reactive;

/// <summary>
/// A value derived from other reactive values. Lazy (computed on the first read), cached, and
/// recomputed only when a dependency actually changed. Owned by the owner current at construction and
/// disposed with it; one created outside any owner stays subscribed to its sources until it is
/// unwatched (spec 4.2).
/// </summary>
public sealed class Computed<T> : OwnerNode
{
    private readonly Func<T> _compute;
    private readonly IEqualityComparer<T> _comparer;
    private T _value = default!;

    public Computed(Func<T> compute, IEqualityComparer<T>? comparer = null)
    {
        _compute = compute;
        _comparer = comparer ?? EqualityComparer<T>.Default;
    }

    /// <summary>Returns the up-to-date value and, inside a tracking scope, subscribes the current observer.</summary>
    public T Value
    {
        get
        {
            Refresh();

            var observer = Tracking.ActiveObserver;

            if (observer is not null)
            {
                DependencyGraph.Link(this, observer, Tracking.Cycle);
            }

            return _value;
        }
    }

    /// <summary>Returns the up-to-date value without subscribing the current observer.</summary>
    public T Peek()
    {
        Refresh();

        return _value;
    }

    /// <summary>
    /// Disposes what the previous run created, runs the function again and reports whether the
    /// result differs from the cached value.
    /// </summary>
    internal override bool Update()
    {
        DisposeOwned();
        DepsTail = null;
        Flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;

        var previousObserver = Tracking.ActiveObserver;
        var previousOwner = Tracking.CurrentOwner;

        Tracking.ActiveObserver = this;
        Tracking.CurrentOwner = this;

        try
        {
            ++Tracking.Cycle;

            var next = _compute();

            if (_comparer.Equals(_value, next))
            {
                return false;
            }

            _value = next;

            return true;
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
            Tracking.CurrentOwner = previousOwner;
            Flags &= ~ReactiveFlags.RecursedCheck;
            DependencyGraph.PurgeDeps(this);
        }
    }

    /// <summary>Computeds are never notified: only watching nodes (effects) are.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A computed cannot be notified.");

    /// <summary>
    /// With no subscriber left, drops the dependencies and what the last run created, and recomputes
    /// on the next read (Solid <c>unobserved</c>).
    /// </summary>
    internal override void Unwatched()
    {
        if (DepsTail is null)
        {
            return;
        }

        Flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        DependencyGraph.DisposeAllDepsInReverse(this);
        DisposeOwned();
    }

    /// <summary>
    /// Unsubscribes from every dependency and freezes the cached value: a later read returns it
    /// without recomputing (Solid: "a post-disposal read freezes at the last committed value").
    /// </summary>
    internal override void OnDisposed()
    {
        DepsTail = null;
        Flags = ReactiveFlags.Mutable;
        DependencyGraph.PurgeDeps(this);
    }

    private void Refresh()
    {
        var flags = Flags;

        if ((flags & ReactiveFlags.Dirty) != 0)
        {
            Recompute();
        }
        else if ((flags & ReactiveFlags.Pending) != 0)
        {
            RecomputeIfDependencyChanged(flags);
        }
        else if (flags == ReactiveFlags.None)
        {
            RunFirst();
        }
    }

    private void RecomputeIfDependencyChanged(ReactiveFlags flags)
    {
        if (DependencyGraph.CheckDirty(Deps!, this))
        {
            Recompute();
        }
        else
        {
            Flags = flags & ~ReactiveFlags.Pending;
        }
    }

    private void Recompute()
    {
        if (!Update())
        {
            return;
        }

        var subs = Subs;

        if (subs is not null)
        {
            DependencyGraph.ShallowPropagate(subs);
        }
    }

    private void RunFirst()
    {
        Flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;

        var previousObserver = Tracking.ActiveObserver;
        var previousOwner = Tracking.CurrentOwner;

        Tracking.ActiveObserver = this;
        Tracking.CurrentOwner = this;

        try
        {
            _value = _compute();
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
            Tracking.CurrentOwner = previousOwner;
            Flags &= ~ReactiveFlags.RecursedCheck;
        }
    }
}
