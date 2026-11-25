namespace Metanui.Reactive.Ownership;

/// <summary>One registered cleanup, chained to the one registered before it.</summary>
internal sealed class CleanupEntry(Action cleanup, CleanupEntry? next)
{
    public readonly Action Cleanup = cleanup;
    public readonly CleanupEntry? Next = next;
}
