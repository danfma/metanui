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

    public static void Run()
    {
        _scheduled = false;

        while (_head is not null)
        {
            var node = _head;

            _head = node.NextPending;
            node.NextPending = null;

            if (_head is null)
            {
                _tail = null;
            }

            node.CommitPending();

            // propagated in Task 3: propagate from the signals whose committed value changed
        }
    }
}
