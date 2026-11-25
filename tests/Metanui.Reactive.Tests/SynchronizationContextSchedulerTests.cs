namespace Metanui.Reactive.Tests;

/// <summary>
/// The .NET adapter of spec 4.7, kept test-local: the core ships no platform scheduler.
/// </summary>
public sealed class SynchronizationContextSchedulerTests
{
    [Test, NotInParallel]
    public async Task WriteFlushesWhenTheContextIsPumped()
    {
        var context = new PumpedSynchronizationContext();
        var applied = new List<int>();
        var dispose = () => { };

        Reactivity.Scheduler = new SynchronizationContextFlushScheduler(context);

        try
        {
            var count = Reactivity.Signal(0);

            dispose = Reactivity.Root<Action>(disposeRoot =>
            {
                Reactivity.Effect(() => count.Value, (value, _) => applied.Add(value));

                return disposeRoot;
            });

            context.Pump();
            applied.Clear();
            count.Value = 1;

            await Assert.That(applied.Count).IsEqualTo(0);

            context.Pump();

            await Assert.That(applied).IsEquivalentTo([1]);
        }
        finally
        {
            dispose();
            Reactivity.Scheduler = new ManualFlushScheduler();
            Reactivity.Flush();
        }
    }
}

/// <summary>Posts each flush to a synchronization context.</summary>
file sealed class SynchronizationContextFlushScheduler(SynchronizationContext context)
    : IFlushScheduler
{
    public void Schedule(Action flush) => context.Post(static state => ((Action)state!)(), flush);
}

/// <summary>A single-threaded context whose posted callbacks run only when the test pumps it.</summary>
file sealed class PumpedSynchronizationContext : SynchronizationContext
{
    private readonly Queue<(SendOrPostCallback Callback, object? State)> _posted = new();

    public override void Post(SendOrPostCallback d, object? state) => _posted.Enqueue((d, state));

    public void Pump()
    {
        while (_posted.TryDequeue(out var posted))
        {
            posted.Callback(posted.State);
        }
    }
}
