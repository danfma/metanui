namespace Metanui.Reactive.Scenarios;

/// <summary>A named behaviour of the reactive core, written once and run on every platform.</summary>
public sealed record Scenario(string Name, Action<IExpect> Run)
{
    public override string ToString() => Name;
}
