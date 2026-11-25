namespace Metanui.Reactive;

/// <summary>Port that decides when a pending flush runs.</summary>
public interface IFlushScheduler
{
    /// <summary>Requests that <paramref name="flush" /> run soon.</summary>
    void Schedule(Action flush);
}

/// <summary>Never runs the flush by itself: only <see cref="Reactivity.Flush" /> drives the graph.</summary>
public sealed class ManualFlushScheduler : IFlushScheduler
{
    public void Schedule(Action flush) { }
}
