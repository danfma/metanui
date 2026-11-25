using Metano.Annotations;

namespace Metanui.Reactive;

#pragma warning disable CS0649 // fields are assigned by the dependency graph (Task 3)

/// <summary>Global tracking state of the graph.</summary>
[Transpile]
internal static class Tracking
{
    /// <summary>The node whose dependencies are being collected; null outside a tracking scope.</summary>
    public static ReactiveNode? Observer;
}
