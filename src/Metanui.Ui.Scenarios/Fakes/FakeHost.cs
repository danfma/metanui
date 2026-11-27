namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>A fake container and port to render a scenario's view into.</summary>
public sealed class FakeHost
{
    public FakePort Port { get; } = new();

    public FakeElement Container { get; } = new("root");

    public IDisposable Render(Action build) => View.Render(build, Container, Port);

    /// <summary>The container's visible children.</summary>
    public string Print() => Container.PrintChildren();
}
