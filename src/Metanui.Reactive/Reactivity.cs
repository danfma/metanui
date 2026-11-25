namespace Metanui.Reactive;

/// <summary>Entry point of the reactive graph (one graph per process).</summary>
public static partial class Reactivity
{
    public static IFlushScheduler Scheduler
    {
        get => FlushLoop.Scheduler;
        set => FlushLoop.Scheduler = value;
    }

    /// <summary>
    /// Applies the pending writes now and runs the flush to completion. Called while a flush is
    /// already running (for instance from an effect's apply), it does nothing: the running flush
    /// drains the new writes in its next pass.
    /// </summary>
    public static void Flush() => FlushLoop.Run();

    /// <summary>
    /// Creates a split effect. <paramref name="compute" /> is tracked and runs now, then in the
    /// compute phase of every flush pass where one of its dependencies changed. <paramref name="apply" />
    /// is untracked and receives the computed value and the value of the previous apply
    /// (<c>default</c> the first time: for a value type that is 0 on .NET but null in TypeScript, an
    /// open API decision); every apply of a pass runs after all computes of that pass,
    /// and the first one runs at the end of the current flush, or of the next one when created outside
    /// a flush. Writes inside <paramref name="apply" /> are allowed and run another pass.
    /// </summary>
    /// <remarks>
    /// Solid's apply returns its cleanup; here an apply registers cleanups with
    /// <see cref="OnCleanup" /> instead. They run, last registered first, before the next apply of
    /// the same effect and when the effect is disposed (disposal arrives with ownership).
    /// If the scheduler throws while the effect is created, the exception escapes this call but the
    /// effect still exists and stays subscribed; its first apply runs on the next flush.
    /// </remarks>
    public static void Effect<T>(Func<T> compute, Action<T, T?> apply) =>
        new SplitEffect<T>(compute, apply).Start();

    /// <summary>
    /// Registers <paramref name="cleanup" />. Directly inside an effect's apply, it runs before that
    /// effect's next apply and on its disposal. Anywhere else (outside an apply, or in a computation
    /// running inside one) the cleanup is dropped until ownership lands.
    /// </summary>
    public static void OnCleanup(Action cleanup)
    {
        var apply = Tracking.ActiveApply;

        // An apply runs with no observer and every computation with one, so a non-null observer means
        // a computation nested in the apply, which must not attach to the apply. Ownership (Task 5)
        // attaches cleanups outside an apply to the current owner.
        if (apply is not null && Tracking.ActiveObserver is null)
        {
            apply.AddApplyCleanup(cleanup);
        }
    }
}
