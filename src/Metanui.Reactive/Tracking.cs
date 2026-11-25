using Metano.Annotations;

namespace Metanui.Reactive;

/// <summary>Global tracking state of the graph.</summary>
[Transpile]
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
}
