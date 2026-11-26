namespace Metanui.Reactive.Scheduling;

/// <summary>
/// Queues of pending work (signal writes, computed retries, effect computes, effect applies),
/// drained by <see cref="Run" /> in passes.
/// </summary>
internal static class FlushLoop
{
    private const int MaxPasses = 100;

    private static readonly string PassLimitMessage =
        $"Reactive flush exceeded {MaxPasses} passes; an effect is probably writing a signal it depends on.";

    /// <summary>Cached so that scheduling a flush does not allocate a delegate each time.</summary>
    private static readonly Action RunFlush = Run;

    /// <summary>The flush re-requested after a failed one: it continues that flush's pass budget.</summary>
    private static readonly Action ResumeFlush = Resume;

    private static IFlushScheduler _scheduler = new ManualFlushScheduler();

    private static SignalNode? _head;
    private static SignalNode? _tail;
    private static ComputedNode? _retryHead;
    private static ComputedNode? _retryTail;
    private static EffectNode? _computeHead;
    private static EffectNode? _computeTail;
    private static EffectNode? _applyHead;
    private static EffectNode? _applyTail;
    private static bool _scheduled;
    private static bool _running;

    /// <summary>
    /// Whether the resume requested after a failed flush is still due. Any flush that runs first
    /// drains the leftovers and clears it, so the stale resume then does nothing.
    /// </summary>
    private static bool _resumePending;

    /// <summary>
    /// Whether the pending resume continues the failed flush's pass budget. A flush request made
    /// after the failure (a write, a retry, a new effect's apply) clears it: the request was folded
    /// into the resume already scheduled, which then runs it as a new flush, with a fresh budget.
    /// </summary>
    private static bool _resumeContinuesBudget;

    /// <summary>
    /// Passes run by the current flush, counting the failed flushes it resumes (see
    /// <see cref="Resume" />), so an effect that throws after writing what it reads still reaches the
    /// pass limit across the flushes re-requested for it.
    /// </summary>
    private static int _passes;

    /// <summary>The scheduler that runs the requested flushes.</summary>
    public static IFlushScheduler Scheduler => _scheduler;

    /// <summary>Whether a flush is running; cleanup errors raised meanwhile are rethrown when it ends.</summary>
    public static bool IsRunning => _running;

    /// <summary>
    /// Makes <paramref name="scheduler" /> run the flushes from now on. A flush requested from the
    /// previous scheduler may never run (a manual one never runs it), so that request is forgotten
    /// and, when work is queued, made again to the new scheduler.
    /// </summary>
    public static void ReplaceScheduler(IFlushScheduler scheduler)
    {
        if (scheduler is null)
        {
            throw new ArgumentNullException(nameof(scheduler));
        }

        _scheduler = scheduler;
        _scheduled = false;

        if (HasWork())
        {
            Request(_resumePending ? ResumeFlush : RunFlush);
        }
    }

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

    /// <summary>
    /// Queues an errored computed for a retry (spec 4.2), once until the next pass runs it, and
    /// requests a flush for it.
    /// </summary>
    public static void EnqueueRetry(ComputedNode computed)
    {
        if (IsQueuedForRetry(computed))
        {
            return;
        }

        if (_retryTail is null)
        {
            _retryHead = computed;
        }
        else
        {
            _retryTail.NextRetry = computed;
        }

        _retryTail = computed;
        RequestFlush();
    }

    /// <summary>
    /// Whether <paramref name="computed" /> is in the retry queue: it links to a next one, or it is the
    /// tail, the only queued computed whose link is null.
    /// </summary>
    private static bool IsQueuedForRetry(ComputedNode computed) =>
        computed.NextRetry is not null || computed == _retryTail;

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
        if (_resumePending)
        {
            _resumeContinuesBudget = false;
        }

        Request(RunFlush);
    }

    private static void Request(Action flush)
    {
        if (_scheduled || _running)
        {
            return;
        }

        _scheduled = true;

        try
        {
            _scheduler.Schedule(flush);
        }
        catch
        {
            _scheduled = false;

            throw;
        }
    }

    /// <summary>
    /// Runs the flush (spec 4.7) in passes until no work is left: retry the computeds queued for a
    /// retry and propagate from the ones that recovered, commit every pending write, propagate from
    /// the signals that changed, run the queued effect computes in queue order, then the applies they
    /// produced. Writes made by the applies, and retries queued by the computes, start another pass.
    /// Called while a flush is running, it returns at once and lets the running flush drain.
    /// </summary>
    /// <remarks>
    /// An error no boundary handles leaves at once (Solid 2.0.4 ordering). The work still queued is
    /// kept and another flush is requested, so the next flush runs it; unlike Solid, the graph is not
    /// halted (spec 4.4). That re-requested flush continues the failed flush's pass budget, unless a
    /// flush was requested before it ran, and a flush that stops at the pass limit requests no other.
    /// Any other flush (a direct call, or one requested by a write) starts with a fresh budget. After a flush that ends normally, the first
    /// cleanup error raised during it is rethrown, unless the flush was called from an error handler,
    /// which would hand it to a boundary: it then waits for the next flush or root disposal.
    /// </remarks>
    /// <exception cref="InvalidOperationException">
    /// More than <see cref="MaxPasses" /> passes were needed; the pending writes and retries are
    /// discarded, and so is the deferred cleanup error, even one raised before the flush started.
    /// </exception>
    public static void Run() => RunWithBudget(0);

    /// <summary>
    /// Runs the flush re-requested after a failed one, continuing its pass budget unless a flush was
    /// requested since the failure. Does nothing when another flush already ran the leftovers: its
    /// pass count belongs to that flush.
    /// </summary>
    private static void Resume()
    {
        if (_resumePending)
        {
            RunWithBudget(_resumeContinuesBudget ? _passes : 0);
        }
    }

    private static void RunWithBudget(int passesUsed)
    {
        if (_running)
        {
            return;
        }

        _running = true;
        _scheduled = false;
        _resumePending = false;
        _resumeContinuesBudget = false;
        _passes = passesUsed;

        var completed = RunPassesOrRequestResume();

        if (!completed)
        {
            DiscardPendingWritesAndRetries();
            Teardown.DiscardFirstError();

            throw new InvalidOperationException(PassLimitMessage);
        }

        if (Tracking.ErrorHandlerDepth == 0)
        {
            Teardown.RethrowFirstError();
        }
    }

    /// <summary>
    /// Runs the passes and clears the running state. When a pass throws, requests a resuming flush
    /// for the work left before the exception leaves. Returns false when the pass limit stopped it.
    /// </summary>
    private static bool RunPassesOrRequestResume()
    {
        try
        {
            var completed = RunPasses();

            _running = false;

            return completed;
        }
        catch
        {
            _running = false;
            RequestResumeForLeftovers();

            throw;
        }
    }

    /// <summary>Runs passes until no work is left (true) or the pass budget is spent (false).</summary>
    private static bool RunPasses()
    {
        while (HasWork())
        {
            if (_passes == MaxPasses)
            {
                return false;
            }

            _passes++;
            Tracking.Pass++;
            PropagateRetries();
            CommitAndPropagate();
            RunComputes();
            RunApplies();
        }

        return true;
    }

    /// <summary>
    /// After a failed flush, asks for a resuming flush when work is left. A scheduler that throws here
    /// is ignored, so the error that failed the flush is the one that leaves; the next write asks again.
    /// </summary>
    private static void RequestResumeForLeftovers()
    {
        if (!HasWork())
        {
            return;
        }

        _resumePending = true;
        _resumeContinuesBudget = true;

        try
        {
            Request(ResumeFlush);
        }
        catch
        {
            // Request already cleared _scheduled; keep the original error.
            _resumePending = false;
            _resumeContinuesBudget = false;
        }
    }

    /// <summary>
    /// Whether any queue holds work: pending writes, retries, effect computes or applies. The compute
    /// queue is empty between passes unless an exception interrupted the last flush.
    /// </summary>
    private static bool HasWork() =>
        _head is not null
        || _retryHead is not null
        || _computeHead is not null
        || _applyHead is not null;

    /// <summary>
    /// Runs the retry of each queued computed (<see cref="ComputedNode.RetryAtPassStart" />) and, when
    /// it reports a change, marks its subscribers as a signal commit marks a changed signal's (see
    /// <see cref="PropagateChanges" />). Each one leaves the queue before its propagation, so one that
    /// throws leaves the rest queued for the next flush.
    /// </summary>
    private static void PropagateRetries()
    {
        while (_retryHead is not null)
        {
            var computed = DequeueRetry();

            if (!computed.RetryAtPassStart())
            {
                continue;
            }

            var subs = computed.Subs;

            if (subs is not null)
            {
                DependencyGraph.Propagate(subs);
                DependencyGraph.ShallowPropagate(subs);
            }
        }
    }

    private static ComputedNode DequeueRetry()
    {
        var computed = _retryHead!;

        _retryHead = computed.NextRetry;
        computed.NextRetry = null;

        if (_retryHead is null)
        {
            _retryTail = null;
        }

        return computed;
    }

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
    /// Drops every queued write and every pending retry after the pass limit, so the graph is usable
    /// again; a computed whose retry is dropped keeps its error until a dependency changes or a later
    /// tracked re-read queues another retry. Computes and applies a failed flush left queued stay, and
    /// run with the next flush: dropping a compute would leave the computeds between the effect and
    /// the changed signal dirty, and a dirty computed stops every later propagation, so the effect
    /// would never run again.
    /// </summary>
    private static void DiscardPendingWritesAndRetries()
    {
        while (_head is not null)
        {
            DequeuePendingWrite().DiscardPending();
        }

        while (_retryHead is not null)
        {
            DequeueRetry();
        }
    }
}
