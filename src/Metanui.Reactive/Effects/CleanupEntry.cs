using Metano.Annotations;

namespace Metanui.Reactive.Effects;

/// <summary>One registered cleanup, chained to the one registered before it.</summary>
[Transpile]
internal sealed class CleanupEntry(Action cleanup, CleanupEntry? next)
{
    public readonly Action Cleanup = cleanup;
    public readonly CleanupEntry? Next = next;
}
