using Metano.Annotations;

namespace Metanui.Reactive.Scheduling;

/// <summary>
/// Queues of pending work (signal writes, effect computes, effect applies), drained by
/// <see cref="Run" /> in passes.
/// </summary>
[Transpile]
internal static class FlushLoop
{
    private const int MaxPasses = 100;

    private const string PassLimitMessage =
        "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";

    public static IFlushScheduler Scheduler = new ManualFlushScheduler();

    private static SignalNode? _head;
    private static SignalNode? _tail;
    private static EffectNode? _computeHead;
    private static EffectNode? _computeTail;
    private static EffectNode? _applyHead;
    private static EffectNode? _applyTail;
    private static bool _scheduled;
    private static bool _running;

    /// <summary>Queues a signal whose pending write the next pass commits.</summary>
    public static void Enqueue(SignalNode node)
    {
        if (_tail is null)
        {
            _head = node;
        }
        else
        {
            _tail.NextPending = node;
        }

        _tail = node;
    }

    /// <summary>Queues a notified effect for the compute phase of the running pass.</summary>
    public static void EnqueueCompute(EffectNode effect)
    {
        if (_computeTail is null)
        {
            _computeHead = effect;
        }
        else
        {
            _computeTail.NextQueued = effect;
        }

        _computeTail = effect;
    }

    /// <summary>Queues the apply of an effect whose compute ran, once until the apply runs.</summary>
    public static void EnqueueApply(EffectNode effect)
    {
        if (effect.HasPendingApply)
        {
            return;
        }

        effect.HasPendingApply = true;

        if (_applyTail is null)
        {
            _applyHead = effect;
        }
        else
        {
            _applyTail.NextApply = effect;
        }

        _applyTail = effect;
        RequestFlush();
    }

    /// <summary>
    /// Asks the scheduler for a flush, unless one is already scheduled or running (a running flush
    /// drains new work in its next pass). A scheduler that throws leaves no flush marked as scheduled,
    /// so the next request asks again.
    /// </summary>
    public static void RequestFlush()
    {
        if (_scheduled || _running)
        {
            return;
        }

        _scheduled = true;

        try
        {
            Scheduler.Schedule(Run);
        }
        catch
        {
            _scheduled = false;

            throw;
        }
    }

    /// <summary>
    /// Runs the flush (spec 4.7) in passes until no work is left: commit every pending write,
    /// propagate from the signals that changed, run the queued effect computes in queue order, then
    /// the applies they produced. Writes made by the applies start another pass. Called while a flush
    /// is running, it returns at once and lets the running flush drain.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// More than <see cref="MaxPasses" /> passes were needed; the pending writes are discarded.
    /// </exception>
    public static void Run()
    {
        if (_running)
        {
            return;
        }

        _running = true;
        _scheduled = false;

        try
        {
            RunPasses();
        }
        finally
        {
            _running = false;
        }
    }

    private static void RunPasses()
    {
        var passes = 0;

        while (HasWork())
        {
            if (passes == MaxPasses)
            {
                DiscardPendingWrites();

                throw new InvalidOperationException(PassLimitMessage);
            }

            passes++;
            CommitAndPropagate();
            RunComputes();
            RunApplies();
        }
    }

    // The compute queue is empty between passes unless an exception interrupted the last flush.
    private static bool HasWork() =>
        _head is not null || _computeHead is not null || _applyHead is not null;

    /// <summary>
    /// Commits every queued write, then propagates from the signals that changed, so propagation
    /// never interleaves with commits. If a comparer throws, the signals already committed are still
    /// propagated before the exception leaves.
    /// </summary>
    private static void CommitAndPropagate()
    {
        SignalNode? changedHead = null;
        SignalNode? changedTail = null;

        try
        {
            while (_head is not null)
            {
                var node = DequeuePendingWrite();

                if (!node.Update())
                {
                    continue;
                }

                if (changedTail is null)
                {
                    changedHead = node;
                }
                else
                {
                    changedTail.NextPending = node;
                }

                changedTail = node;
            }
        }
        finally
        {
            PropagateChanges(changedHead);
        }
    }

    private static SignalNode DequeuePendingWrite()
    {
        var node = _head!;

        _head = node.NextPending;
        node.NextPending = null;

        if (_head is null)
        {
            _tail = null;
        }

        return node;
    }

    /// <summary>
    /// Marks the subscribers of each changed signal: direct ones dirty, deeper ones pending
    /// (alien-signals signals are marked dirty and committed on read; here the flush already
    /// committed them, so the direct subscribers are dirtied right away, as alien-signals trigger does).
    /// Watching subscribers (effects) are queued for the compute phase. If a propagation throws, the
    /// signals left are unchained so none keeps a stale NextPending.
    /// </summary>
    private static void PropagateChanges(SignalNode? changed)
    {
        var node = changed;

        try
        {
            while (node is not null)
            {
                var subs = node.Subs;

                if (subs is not null)
                {
                    DependencyGraph.Propagate(subs);
                    DependencyGraph.ShallowPropagate(subs);
                }

                node = Unchain(node);
            }
        }
        finally
        {
            while (node is not null)
            {
                node = Unchain(node);
            }
        }
    }

    private static SignalNode? Unchain(SignalNode node)
    {
        var next = node.NextPending;

        node.NextPending = null;

        return next;
    }

    /// <summary>Runs the queued computes in queue order, including effects queued while it runs.</summary>
    private static void RunComputes()
    {
        while (_computeHead is not null)
        {
            var effect = _computeHead;

            _computeHead = effect.NextQueued;
            effect.NextQueued = null;

            if (_computeHead is null)
            {
                _computeTail = null;
            }

            effect.RunIfDirty();
        }
    }

    /// <summary>Runs the queued applies in queue order, including applies queued while it runs.</summary>
    private static void RunApplies()
    {
        while (_applyHead is not null)
        {
            var effect = _applyHead;

            _applyHead = effect.NextApply;
            effect.NextApply = null;
            effect.HasPendingApply = false;

            if (_applyHead is null)
            {
                _applyTail = null;
            }

            effect.RunApply();
        }
    }

    /// <summary>
    /// Drops every queued write after the pass limit, so the graph is usable again. A pass that ends
    /// normally drains the compute and apply queues, so writes are the only work left.
    /// </summary>
    private static void DiscardPendingWrites()
    {
        while (_head is not null)
        {
            DequeuePendingWrite().DiscardPending();
        }
    }
}
