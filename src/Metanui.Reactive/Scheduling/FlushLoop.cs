using Metano.Annotations;

namespace Metanui.Reactive.Scheduling;

/// <summary>Queue of signals with pending writes, drained by <see cref="Run" />.</summary>
[Transpile]
internal static class FlushLoop
{
    public static IFlushScheduler Scheduler = new ManualFlushScheduler();

    private static SignalNode? _head;
    private static SignalNode? _tail;
    private static bool _scheduled;

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

        if (!_scheduled)
        {
            _scheduled = true;
            Scheduler.Schedule(Run);
        }
    }

    /// <summary>
    /// Runs one flush in phases (spec 4.7): commit every pending write, then propagate from the
    /// signals that changed, so propagation never interleaves with commits. The effect phases
    /// (run computes, then applies) follow propagation.
    /// </summary>
    public static void Run()
    {
        _scheduled = false;

        var changed = CommitPendingWrites();

        PropagateChanges(changed);
    }

    /// <summary>Commits every queued write and returns the signals that changed, chained through NextPending.</summary>
    private static SignalNode? CommitPendingWrites()
    {
        SignalNode? changedHead = null;
        SignalNode? changedTail = null;

        while (_head is not null)
        {
            var node = _head;

            _head = node.NextPending;
            node.NextPending = null;

            if (_head is null)
            {
                _tail = null;
            }

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

        return changedHead;
    }

    /// <summary>
    /// Marks the subscribers of each changed signal: direct ones dirty, deeper ones pending
    /// (alien-signals signals are marked dirty and committed on read; here the flush already
    /// committed them, so the direct subscribers are dirtied right away, as alien-signals trigger does).
    /// </summary>
    private static void PropagateChanges(SignalNode? changed)
    {
        var node = changed;

        while (node is not null)
        {
            var next = node.NextPending;

            node.NextPending = null;

            var subs = node.Subs;

            if (subs is not null)
            {
                DependencyGraph.Propagate(subs);
                DependencyGraph.ShallowPropagate(subs);
            }

            node = next;
        }
    }
}
