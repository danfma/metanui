using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios.Components;

/// <summary>A component with a plain prop, which <see cref="Render" /> reads once.</summary>
public sealed class Counter : Component<Counter>
{
    public int Start { get; set; }

    // Metano #832
    public static void Create(Action<Counter> build) => Mount(new Counter(), build);

    public override void Render() => Label(label => label.Text = $"start={Start}");
}
