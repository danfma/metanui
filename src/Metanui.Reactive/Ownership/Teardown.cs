namespace Metanui.Reactive.Ownership;

/// <summary>
/// Runs the cleanups of a disposal: before a computation re-runs, and when its owner is disposed.
/// Follows <c>@solidjs/signals</c> 2.0.4 (<c>runCleanup</c>, <c>disposalDepth</c>,
/// <c>rethrowCleanupError</c>): a throwing cleanup does not stop the walk; the first error is kept
/// and rethrown once, by the root disposer outside a flush or at the end of the flush. Cleanup errors
/// never go to an error boundary.
/// </summary>
internal static class Teardown
{
    /// <summary>Nesting depth of running cleanup chains. Signal writes are allowed while it is above 0.</summary>
    public static int Depth;

    private static Exception? _firstError;

    /// <summary>Runs every cleanup of the chain, in chain order, and keeps the first error thrown.</summary>
    public static void Run(CleanupEntry? entry)
    {
        Depth++;

        var error = RunChain(entry);

        Depth--;
        _firstError ??= error;
    }

    /// <summary>
    /// Runs every cleanup of the chain, in chain order, even after one throws, and returns the first
    /// error thrown, or null. Used directly for the cleanups an apply runs before the next apply, whose
    /// error is the apply's own.
    /// </summary>
    public static Exception? RunChain(CleanupEntry? entry)
    {
        Exception? firstError = null;

        while (entry is not null)
        {
            // Not `firstError ??= RunOne(...)`: that would skip the cleanups after the first error.
            var error = RunOne(entry.Cleanup);

            firstError ??= error;
            entry = entry.Next;
        }

        return firstError;
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

    private static Exception? RunOne(Action cleanup)
    {
        try
        {
            cleanup();

            return null;
        }
        catch (Exception error)
        {
            return error;
        }
    }
}
