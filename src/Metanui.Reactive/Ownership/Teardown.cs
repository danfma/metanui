using Metano.Annotations;

namespace Metanui.Reactive.Ownership;

/// <summary>
/// Runs the cleanups of a disposal: before a computation re-runs, and when its owner is disposed.
/// Follows <c>@solidjs/signals</c> 2.0.4 (<c>runCleanup</c>, <c>disposalDepth</c>,
/// <c>rethrowCleanupError</c>): a throwing cleanup does not stop the walk; the first error is kept
/// and rethrown once, by the root disposer outside a flush or at the end of the flush. Cleanup errors
/// never go to an error boundary.
/// </summary>
[Transpile]
internal static class Teardown
{
    /// <summary>Nesting depth of running cleanup chains. Signal writes are allowed while it is above 0.</summary>
    public static int Depth;

    private static Exception? _firstError;

    /// <summary>Runs every cleanup of the chain, in chain order, and keeps the first error thrown.</summary>
    public static void Run(CleanupEntry? entry)
    {
        Depth++;

        while (entry is not null)
        {
            RunOne(entry.Cleanup);
            entry = entry.Next;
        }

        Depth--;
    }

    /// <summary>Throws the error kept since the last call, if any, and forgets it.</summary>
    public static void RethrowFirstError()
    {
        var error = _firstError;

        if (error is null)
        {
            return;
        }

        _firstError = null;

        throw error;
    }

    private static void RunOne(Action cleanup)
    {
        try
        {
            cleanup();
        }
        catch (Exception error)
        {
            _firstError ??= error;
        }
    }
}
