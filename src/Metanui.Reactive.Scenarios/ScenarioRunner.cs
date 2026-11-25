namespace Metanui.Reactive.Scenarios;

/// <summary>Runs scenarios the same way on every platform.</summary>
public static class ScenarioRunner
{
    public static void Run(Scenario scenario, IExpect expect) => scenario.Run(expect);

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
