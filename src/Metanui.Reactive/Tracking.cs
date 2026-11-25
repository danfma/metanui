using Metano.Annotations;

namespace Metanui.Reactive;

/// <summary>Global tracking state of the graph.</summary>
[Transpile]
internal static class Tracking
{
    /// <summary>The node whose dependencies are being collected; null outside a tracking scope.</summary>
    public static ReactiveNode? ActiveObserver;

    /// <summary>
    /// Version stamped on the links created during one run (alien-signals <c>cycle</c>); bumped on
    /// every recomputation so that a repeated read of the same dependency links only once.
    /// </summary>
    public static int Cycle;

    /// <summary>The effect whose apply is running; null outside an apply. Owns the cleanups registered meanwhile.</summary>
    public static EffectNode? ActiveApply;
}
