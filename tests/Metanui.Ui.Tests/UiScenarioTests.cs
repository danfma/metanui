using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios;

namespace Metanui.Ui.Tests;

public sealed class UiScenarioTests
{
    [Test, MethodDataSource(nameof(Cases)), NotInParallel]
    public void Runs(Scenario scenario) => ScenarioRunner.Run(scenario, new ThrowingExpect());

    public static IEnumerable<Func<Scenario>> Cases() =>
        UiScenarios.All.Select(scenario => (Func<Scenario>)(() => scenario));
}
