namespace Metanui.Reactive.Scenarios;

/// <summary>Runs scenarios the same way on every platform.</summary>
public static class ScenarioRunner
{
    /// <summary>
    /// Runs <paramref name="scenario" /> from a clean graph: a manual scheduler, a root that owns
    /// everything the scenario creates, a final flush, then the root's disposal (even on failure).
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
        finally
        {
            dispose();
        }
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
}
