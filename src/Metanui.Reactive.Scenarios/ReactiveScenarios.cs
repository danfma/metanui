namespace Metanui.Reactive.Scenarios;

/// <summary>Every scenario of the reactive core; each phase appends its scenario class here.</summary>
public static class ReactiveScenarios
{
    public static Scenario[] All { get; } =
    [
        .. SignalScenarios.All,
        .. ComputedScenarios.All,
        .. EffectScenarios.All,
        .. FlushScenarios.All,
        .. OwnershipScenarios.All,
        .. ErrorScenarios.All,
        .. MapScenarios.All,
    ];
}
