namespace Metanui.Reactive;

/// <summary>
/// A value derived from other reactive values. Lazy (computed on the first read), cached, and
/// recomputed only when a dependency actually changed: Solid's <c>createMemo</c> with
/// <c>lazy: true</c>. Owned by the owner current at construction and disposed with it; one created
/// outside any owner stays subscribed to its sources until it is unwatched. Losing its last
/// subscriber unlinks it and disposes what its last run created, and the next read runs it again
/// (spec 4.2).
/// </summary>
/// <remarks>
/// An exception thrown by the function is cached with <see cref="ReactiveFlags.Errored" /> and
/// rethrown, the same instance, by every read until a dependency changes. As in Solid 2.0.4, a
/// tracked re-read in a later flush pass than the failure also retries it, so a computed that failed
/// before reading any dependency is not stuck for good; here the retry runs in the next flush pass
/// (spec 4.2).
/// </remarks>
public sealed class Computed<T> : ComputedNode
{
    private Func<T>? _compute;
    private IEqualityComparer<T>? _comparer;
    private T _value = default!;
    private Exception? _error;
    private int _errorPass;

    internal Computed(Func<T> compute, IEqualityComparer<T>? comparer = null)
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

            if ((Flags & ReactiveFlags.Errored) != 0)
            {
                return ReadErrored(observer);
            }

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

        if ((Flags & ReactiveFlags.Errored) != 0)
        {
            throw _error!;
        }

        return _value;
    }

    /// <summary>
    /// Disposes what the previous run created, runs the function again and reports whether the
    /// result differs from the cached one. A run that throws caches the error and reports a change, and
    /// so does the first good run after an error. The function and the comparer are read first: a
    /// cleanup or a run that disposes this computed releases them, and the run still completes, so a
    /// later read returns its result.
    /// </summary>
    internal override bool Update()
    {
        var compute = _compute!;
        var comparer = _comparer!;

        DisposeOwned();

        var wasErrored = (Flags & ReactiveFlags.Errored) != 0;

        _error = null;
        DepsTail = null;
        Flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;

        var previousObserver = Tracking.ActiveObserver;
        var previousOwner = Tracking.CurrentOwner;

        Tracking.ActiveObserver = this;
        Tracking.CurrentOwner = this;

        try
        {
            ++Tracking.Cycle;

            var next = compute();

            if (!wasErrored && comparer.Equals(_value, next))
            {
                return false;
            }

            _value = next;

            return true;
        }
        catch (Exception error)
        {
            CacheError(error);

            return true;
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
            Tracking.CurrentOwner = previousOwner;
            Flags &= ~ReactiveFlags.RecursedCheck;
            PurgeStaleDeps();
        }
    }

    /// <summary>
    /// Runs the function again, before the pass commits anything, and reports whether it recovered:
    /// only a recovery is a change for the subscribers. A run that fails again keeps the new error
    /// silently, since every observer already saw an error for the change that asked for the retry.
    /// A computed disposed since it was queued, or no longer errored (an unwatch cleared the error,
    /// or a read recomputed it), is skipped.
    /// </summary>
    internal override bool RetryAtPassStart()
    {
        if (IsDisposed || (Flags & ReactiveFlags.Errored) == 0)
        {
            return false;
        }

        Update();

        return (Flags & ReactiveFlags.Errored) == 0;
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
    /// Unsubscribes from every dependency and freezes the cached value or error: a later read returns
    /// or rethrows it without recomputing (Solid: "a post-disposal read freezes at the last committed
    /// value"). The function and the comparer are released, since nothing runs them again; the cached
    /// value and error stay, as the frozen read returns them.
    /// </summary>
    internal override void OnDisposed()
    {
        DepsTail = null;
        Flags = ReactiveFlags.Mutable | (Flags & ReactiveFlags.Errored);
        DependencyGraph.PurgeDeps(this);
        _compute = null;
        _comparer = null;
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
            _value = _compute!();
        }
        catch (Exception error)
        {
            CacheError(error);
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
            Tracking.CurrentOwner = previousOwner;
            Flags &= ~ReactiveFlags.RecursedCheck;
            PurgeStaleDeps();
        }
    }

    private void CacheError(Exception error)
    {
        _error = error;
        _errorPass = Tracking.Pass;
        Flags |= ReactiveFlags.Errored;
    }

    /// <summary>
    /// Read of an errored computed: subscribes the observer like a normal read, then rethrows the
    /// cached error. Solid 2.0.4 <c>read</c> (F-9): only a tracked re-read (the observer read this
    /// computed at the same position in its previous run) in a later flush pass than the failure
    /// retries the function.
    /// </summary>
    /// <remarks>
    /// Unlike Solid, the retry does not run here: it is queued, and the next flush pass runs it at its
    /// start (<see cref="RetryAtPassStart" />), so every observer of this pass, this one included,
    /// sees the same cached error, and no dirty check in progress sees the graph change under it. The
    /// retry condition is checked before the link, which moves the observer's dependency tail, and the
    /// retry is queued after it, so a scheduler that throws on the flush request leaves the observer
    /// subscribed.
    /// </remarks>
    private T ReadErrored(ReactiveNode? observer)
    {
        if (observer is null)
        {
            throw _error!;
        }

        var retry = IsNextDependencyOf(observer) && _errorPass != Tracking.Pass && !IsDisposed;

        DependencyGraph.Link(this, observer, Tracking.Cycle);

        if (retry)
        {
            FlushLoop.EnqueueRetry(this);
        }

        throw _error!;
    }

    /// <summary>Whether <paramref name="observer" />'s running pass is about to reuse its link to this computed.</summary>
    private bool IsNextDependencyOf(ReactiveNode observer)
    {
        var tail = observer.DepsTail;
        var next = tail is not null ? tail.NextDep : observer.Deps;

        return next is not null && next.Dep == this;
    }
}
