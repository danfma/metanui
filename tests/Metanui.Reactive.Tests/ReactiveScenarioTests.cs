using Metanui.Reactive.Scenarios;

namespace Metanui.Reactive.Tests;

public sealed class ReactiveScenarioTests
{
    [Test, MethodDataSource(nameof(Cases)), NotInParallel]
    public void Runs(Scenario scenario) => ScenarioRunner.Run(scenario, new ThrowingExpect());

    public static IEnumerable<Func<Scenario>> Cases() =>
        ReactiveScenarios.All.Select(scenario => (Func<Scenario>)(() => scenario));
}
