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

    /// <summary>Creates a signal holding <paramref name="initialValue" />.</summary>
    public static Signal<T> Signal<T>(T initialValue, IEqualityComparer<T>? comparer = null) =>
        new(initialValue, comparer);

    /// <summary>Creates a computed value, evaluated lazily and cached until a dependency changes.</summary>
    public static Computed<T> Computed<T>(Func<T> compute, IEqualityComparer<T>? comparer = null) =>
        new(compute, comparer);

    /// <summary>
    /// Creates a split effect. <paramref name="compute" /> is tracked and runs now, then in the
    /// compute phase of every flush pass where one of its dependencies changed. <paramref name="apply" />
    /// is untracked and receives the computed value and the value of the previous apply
    /// (the computed value itself the first time, so <c>previous</c> is never <c>default</c>); every apply of a pass runs after all computes of that pass,
    /// and the first one runs at the end of the current flush, or of the next one when created outside
    /// a flush. Writes inside <paramref name="apply" /> are allowed and run another pass.
    /// </summary>
    /// <remarks>
    /// Solid's apply returns its cleanup; here an apply registers cleanups with
    /// <see cref="OnCleanup" /> instead. They run, last registered first, before the next apply of
    /// the same effect and when the effect is disposed with its owner.
    /// If the scheduler throws while the effect is created, the exception escapes this call but the
    /// effect still exists and stays subscribed; its first apply runs on the next flush.
    /// </remarks>
    public static void Effect<T>(Func<T> compute, Action<T, T> apply) =>
        new SplitEffect<T>(compute, apply).Start();

    /// <summary>
    /// Runs <paramref name="body" /> under a new owner, untracked, and hands it the disposer, which
    /// disposes everything created and registered under that owner. As in Solid 2.0.4, a root
    /// created under an owner is owned by it and disposed with it; calling the disposer earlier
    /// detaches it. Writing a signal directly in the body is allowed (Solid rejects it).
    /// </summary>
    public static T Root<T>(Func<Action, T> body) => new RootNode().Run(body);

    /// <inheritdoc cref="Root{T}" />
    public static void Root(Action<Action> body) =>
        Root(dispose =>
        {
            body(dispose);

            return true;
        });

    /// <summary>
    /// Registers <paramref name="cleanup" /> on the current owner; cleanups of one owner run last
    /// registered first. In a computation it runs before the next run and on disposal; in an
    /// effect's apply (which has no owner), before the next apply of that effect and on its disposal;
    /// in a root body, on the root's disposal. Anywhere else it does nothing (Solid warns in dev).
    /// </summary>
    public static void OnCleanup(Action cleanup)
    {
        var owner = Tracking.CurrentOwner;

        if (owner is not null)
        {
            owner.AddCleanup(cleanup);
        }
        else
        {
            Tracking.ActiveApply?.AddApplyCleanup(cleanup);
        }
    }

    /// <summary>
    /// Runs <paramref name="body" /> with no observer, so its reads subscribe nothing. The current
    /// owner is kept: computations created inside are still owned, and a signal write inside a
    /// computation still throws.
    /// </summary>
    public static T Untrack<T>(Func<T> body)
    {
        var previousObserver = Tracking.ActiveObserver;

        Tracking.ActiveObserver = null;

        try
        {
            return body();
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;
        }
    }
}
