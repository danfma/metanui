using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios.Components;

/// <summary>A component with a plain prop, which <see cref="Render" /> reads once.</summary>
public sealed class StartCounter : Component<StartCounter>
{
    public int Start { get; set; }

    // Metano #832
    public static void Counter(Action<StartCounter> build) => Mount(new StartCounter(), build);

    public override void Render() => Label(label => label.Text = $"start={Start}");
}
