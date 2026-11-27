using Metanui.Reactive.Scenarios;

namespace Metanui.Ui.Scenarios;

/// <summary>Every scenario of the UI layer, run with the reactive core's scenario runner.</summary>
public static class UiScenarios
{
    public static Scenario[] All { get; } =
    [
        .. BuildingScenarios.All,
        .. BindingScenarios.All,
        .. ComponentScenarios.All,
        .. ForScenarios.All,
        .. ShowScenarios.All,
        .. RenderScenarios.All,
    ];
}
