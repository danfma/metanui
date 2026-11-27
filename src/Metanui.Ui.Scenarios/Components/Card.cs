using Metanui.Reactive;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios.Components;

/// <summary>A component with a signal-backed prop and content inside its own element.</summary>
public sealed class Card : Component<Card>
{
    private readonly Signal<string> _title = Reactivity.Signal("");

    public string Title
    {
        get => _title.Value;
        set => _title.Value = value;
    }

    // Metano #832
    public static void Create(Action<Card> build) => Mount(new Card(), build);

    public override void Render() =>
        Box(card =>
        {
            card.Text = "card";
            Label(title => Bind(() => title.Text = Title));
            Content?.Invoke();
        });
}
