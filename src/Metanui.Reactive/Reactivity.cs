namespace Metanui.Reactive;

/// <summary>Entry point of the reactive graph (one graph per process).</summary>
public static partial class Reactivity
{
    public static IFlushScheduler Scheduler
    {
        get => FlushLoop.Scheduler;
        set => FlushLoop.Scheduler = value;
    }

    /// <summary>Applies the pending writes now.</summary>
    public static void Flush() => FlushLoop.Run();
}
