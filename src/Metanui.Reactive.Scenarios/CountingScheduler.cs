using Metano.Annotations;

namespace Metanui.Reactive.Scenarios;

/// <summary>Counts flush requests without running them; optionally throws on the first one.</summary>
[Transpile]
internal sealed class CountingScheduler(bool failFirst = false) : IFlushScheduler
{
    public int Requests { get; private set; }

    public void Schedule(Action flush)
    {
        Requests++;

        if (failFirst && Requests == 1)
        {
            throw new InvalidOperationException("Scheduler failed.");
        }
    }
}
