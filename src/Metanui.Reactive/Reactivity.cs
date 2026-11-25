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
    /// (<c>default</c> the first time); every apply of a pass runs after all computes of that pass,
    /// and the first one runs at the end of the current flush, or of the next one when created outside
    /// a flush. Writes inside <paramref name="apply" /> are allowed and run another pass.
    /// </summary>
    /// <remarks>
    /// Solid's apply returns its cleanup; here an apply registers cleanups with
    /// <see cref="OnCleanup" /> instead. They run, last registered first, before the next apply of
    /// the same effect and when the effect is disposed (disposal arrives with ownership).
    /// </remarks>
    public static void Effect<T>(Func<T> compute, Action<T, T?> apply) =>
        new SplitEffect<T>(compute, apply).Start();

    /// <summary>
    /// Registers <paramref name="cleanup" />. Inside an effect's apply, it runs before that effect's
    /// next apply and on its disposal.
    /// </summary>
    public static void OnCleanup(Action cleanup)
    {
        var apply = Tracking.ActiveApply;

        // Outside an apply there is no owner to attach to yet; ownership (Task 5) attaches the
        // cleanup to the current owner.
        if (apply is not null)
        {
            apply.AddApplyCleanup(cleanup);
        }
    }
}
