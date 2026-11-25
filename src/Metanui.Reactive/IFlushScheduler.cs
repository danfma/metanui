namespace Metanui.Reactive;

/// <summary>Port that decides when a pending flush runs.</summary>
public interface IFlushScheduler
{
    /// <summary>Requests that <paramref name="flush" /> run soon.</summary>
    void Schedule(Action flush);
}

/// <summary>Never runs the flush by itself: only <see cref="Reactivity.Flush" /> drives the graph.</summary>
/// <remarks>
/// A disposed effect whose compute or apply is still queued keeps its bare node (no callbacks, values
/// or dependencies) until the next flush. With this scheduler that retention accumulates for as long
/// as nothing calls <see cref="Reactivity.Flush" />.
/// </remarks>
public sealed class ManualFlushScheduler : IFlushScheduler
{
    public void Schedule(Action flush) { }
}
