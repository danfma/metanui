using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Counter.Ui;

/// <summary>The web adapter of spec 4.7: a write flushes on the next microtask.</summary>
public sealed class MicrotaskScheduler : IFlushScheduler
{
    public void Schedule(Action flush) => Browser.QueueMicrotask(flush);
}
