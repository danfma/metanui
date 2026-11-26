namespace Metanui.Reactive;

/// <summary>Global tracking state of the graph.</summary>
internal static class Tracking
{
    /// <summary>The node whose dependencies are being collected; null outside a tracking scope.</summary>
    public static ReactiveNode? ActiveObserver;

    /// <summary>
    /// The owner of the computations created and the cleanups registered now; null outside any
    /// owner. Untracking clears <see cref="ActiveObserver" /> but keeps the owner.
    /// </summary>
    public static OwnerNode? CurrentOwner;

    /// <summary>
    /// The effect whose apply is running; null outside an apply. An apply has no owner: its cleanups
    /// go to this effect, and creating a computation there throws.
    /// </summary>
    public static EffectNode? ActiveApply;

    /// <summary>
    /// Version stamped on the links created during one run (alien-signals <c>cycle</c>); bumped on
    /// every recomputation so that a repeated read of the same dependency links only once.
    /// </summary>
    public static int Cycle;

    /// <summary>
    /// Number of flush passes started (Solid <c>clock</c>). An errored computed retries on a tracked
    /// re-read only in a later pass than the one where it failed.
    /// </summary>
    public static int Pass;

    /// <summary>
    /// Nesting depth of running dirty checks. While it is above 0, a disposed node keeps its
    /// dependency links until the outermost check ends (see
    /// <see cref="OwnerNode.UnlinkDependenciesOnDisposal" />).
    /// </summary>
    public static int DirtyCheckDepth;

    /// <summary>
    /// Nesting depth of running error handlers. A handler runs with no owner, yet an exception it
    /// throws goes to the next boundary up, so a cleanup error raised there (by a disposer, or at the
    /// end of a flush the handler runs) stays deferred (spec 4.5).
    /// </summary>
    public static int ErrorHandlerDepth;
}
