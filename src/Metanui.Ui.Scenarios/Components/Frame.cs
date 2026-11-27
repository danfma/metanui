using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios.Components;

/// <summary>A component with no element of its own: its content lands between two siblings.</summary>
public sealed class Frame : Component<Frame>
{
    // Metano #832
    public static void Create(Action<Frame> build) => Mount(new Frame(), build);

    public override void Render()
    {
        Label("before");
        Content?.Invoke();
        Label("after");
    }
}
