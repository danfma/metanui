namespace Metanui.Reactive.Scenarios;

/// <summary>Runs scenarios the same way on every platform.</summary>
public static class ScenarioRunner
{
    /// <summary>
    /// Runs <paramref name="scenario" /> from a clean graph: a manual scheduler, a root that owns
    /// everything the scenario creates, a final flush, then the root's disposal and a flush that
    /// drains whatever a failure left queued. When the scenario fails, that teardown still runs, and
    /// its own errors are dropped so the scenario's error is the one reported.
    /// </summary>
    public static void Run(Scenario scenario, IExpect expect)
    {
        Action dispose = () => { };

        Reactivity.Scheduler = new ManualFlushScheduler();

        try
        {
            Reactivity.Root(disposeRoot =>
            {
                dispose = disposeRoot;
                scenario.Run(expect);
            });

            Reactivity.Flush();
        }
        catch
        {
            Catch(() => Settle(dispose));

            throw;
        }

        Settle(dispose);
    }

    public static Exception? Catch(Action action)
    {
        try
        {
            action();

            return null;
        }
        catch (Exception exception)
        {
            return exception;
        }
    }

    /// <summary>
    /// Disposes the scenario root, then flushes, so writes, computes and applies a failed flush left
    /// queued do not leak into the next scenario: the effects are disposed, so only the writes commit.
    /// </summary>
    private static void Settle(Action dispose)
    {
        try
        {
            dispose();
        }
        finally
        {
            Reactivity.Flush();
        }
    }
}
