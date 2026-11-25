using Metano.Annotations;

namespace Metanui.Reactive.Effects;

/// <summary>
/// Graph node of a split effect (spec 4.3): a tracked compute that runs in the compute phase of a
/// flush pass, and an untracked apply that runs after every compute of that pass. The value-typed
/// part lives in <see cref="SplitEffect{T}" />; this class holds what the flush loop drives.
/// </summary>
/// <remarks>
/// Adapted from alien-signals 3.2.1 (stackblitz/alien-signals@8734d386d925025d0e99419bd9161c17b112c5ee,
/// src/index.ts <c>effect</c>, <c>notify</c> and <c>run</c>): upstream runs one function per effect;
/// here <c>run</c> recomputes and queues the apply instead. Effects are not linked under a parent
/// effect (upstream <c>HasChildEffect</c>): ownership is the separate <see cref="OwnerNode" /> tree.
/// The compute owns what it creates. The apply runs with no owner (Solid 2.0.4 effect phase), so it
/// cannot create computations; its cleanups form a separate chain, run before the next apply and
/// last on disposal, like the cleanup a Solid effect function returns.
/// An exception from the compute or the apply goes to the nearest error boundary among the owners;
/// with none it escapes (spec 4.4). A failed compute queues no apply.
/// </remarks>
[Transpile]
internal abstract class EffectNode : OwnerNode
{
    /// <summary>Next effect in the flush queue of computes to run.</summary>
    internal EffectNode? NextQueued;

    /// <summary>Next effect in the flush queue of applies to run.</summary>
    internal EffectNode? NextApply;

    /// <summary>Whether the effect is in the apply queue; a compute that reruns before its apply does not queue it twice.</summary>
    internal bool HasPendingApply;

    private CleanupEntry? _applyCleanups;

    /// <summary>Runs the compute for the first time and queues the first apply.</summary>
    internal void Start()
    {
        if (TryRunCompute())
        {
            FlushLoop.EnqueueApply(this);
        }
    }

    /// <summary>
    /// Compute phase of a flush (upstream <c>run</c>): recomputes when a dependency changed and
    /// queues the apply; otherwise only re-arms the effect for the next notification.
    /// </summary>
    internal void RunIfDirty()
    {
        if (IsDisposed)
        {
            return;
        }

        var flags = Flags;

        if (
            (flags & ReactiveFlags.Dirty) != 0
            || ((flags & ReactiveFlags.Pending) != 0 && DependencyGraph.CheckDirty(Deps!, this))
        )
        {
            if (TryRunCompute())
            {
                FlushLoop.EnqueueApply(this);
            }
        }
        else if (Deps is not null)
        {
            Flags = ReactiveFlags.Watching;
        }
    }

    /// <summary>
    /// Apply phase of a flush: runs the cleanups of the previous apply, then the apply, untracked and
    /// with no owner. A disposed effect's queued apply is skipped, and so is the apply of an effect
    /// that one of those cleanups disposed. An exception from either goes to the nearest error
    /// boundary, or escapes.
    /// </summary>
    internal void RunApply()
    {
        if (IsDisposed)
        {
            return;
        }

        try
        {
            RunApplyUnowned();
        }
        catch (Exception error)
        {
            if (!RootNode.TryRouteError(this, error))
            {
                throw;
            }
        }
    }

    private void RunApplyUnowned()
    {
        var previousObserver = Tracking.ActiveObserver;
        var previousOwner = Tracking.CurrentOwner;
        var previousApply = Tracking.ActiveApply;

        Tracking.ActiveObserver = null;
        Tracking.CurrentOwner = null;

        try
        {
            RunApplyCleanups();

            if (IsDisposed)
            {
                return;
            }

            Tracking.ActiveApply = this;
            Apply();
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveApply = previousApply;
        }
    }

    /// <summary>Attaches <paramref name="cleanup" /> to the running apply; cleanups run last registered first.</summary>
    internal void AddApplyCleanup(Action cleanup) =>
        _applyCleanups = new CleanupEntry(cleanup, _applyCleanups);

    /// <summary>
    /// Queues the effect for the compute phase (upstream <c>notify</c>). Clearing
    /// <see cref="ReactiveFlags.Watching" /> makes the second notification of a signal commit
    /// (propagate, then shallow propagate) a no-op, so the effect is queued once.
    /// </summary>
    internal override void Notify()
    {
        Flags &= ~ReactiveFlags.Watching;
        FlushLoop.EnqueueCompute(this);
    }

    /// <summary>
    /// After the compute's children and cleanups: runs the last apply's cleanups (last, as Solid runs
    /// the effect's returned cleanup), unsubscribes from every dependency and releases the user
    /// callbacks and values. A disposed effect may stay in a flush queue until the walk passes it, so
    /// only the queue links survive.
    /// </summary>
    internal override void OnDisposed()
    {
        var applyCleanups = _applyCleanups;

        _applyCleanups = null;
        Teardown.Run(applyCleanups);
        DepsTail = null;
        Flags = ReactiveFlags.None;
        DependencyGraph.PurgeDeps(this);
        ReleaseUserState();
    }

    /// <summary>Effects are subscribers only, so no dependency walk ever asks them to update.</summary>
    internal override bool Update() =>
        throw new InvalidOperationException("An effect cannot be updated.");

    /// <summary>Runs the user compute and keeps its result for the next apply.</summary>
    protected abstract void Compute();

    /// <summary>Runs the user apply with the last computed value and the previously applied one.</summary>
    protected abstract void Apply();

    /// <summary>Drops the user compute, apply and values, so a disposed effect retains none of them.</summary>
    protected abstract void ReleaseUserState();

    /// <summary>
    /// Runs the compute; an exception goes to the nearest error boundary and makes it return false,
    /// or escapes when there is none.
    /// </summary>
    private bool TryRunCompute()
    {
        try
        {
            RunCompute();

            return true;
        }
        catch (Exception error)
        {
            if (!RootNode.TryRouteError(this, error))
            {
                throw;
            }

            return false;
        }
    }

    /// <summary>
    /// Disposes what the previous compute created, then runs the compute as the observer and owner.
    /// A cleanup that disposed the effect skips the compute; a compute that disposed its own effect
    /// keeps no dependency.
    /// </summary>
    private void RunCompute()
    {
        DisposeOwned();

        if (IsDisposed)
        {
            return;
        }

        DepsTail = null;
        Flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;

        var previousObserver = Tracking.ActiveObserver;
        var previousOwner = Tracking.CurrentOwner;

        Tracking.ActiveObserver = this;
        Tracking.CurrentOwner = this;

        try
        {
            ++Tracking.Cycle;
            Compute();
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
    /// Runs the previous apply's cleanups as part of the next apply. A throwing cleanup does not stop
    /// the others; the first error is then the apply's error, and the apply does not run.
    /// </summary>
    private void RunApplyCleanups()
    {
        var entry = _applyCleanups;

        _applyCleanups = null;

        var error = Teardown.RunChain(entry);

        if (error is not null)
        {
            throw error;
        }
    }
}
