using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios.Components;

/// <summary>A component with a <see cref="Prop{T}" /> and content inside its own element.</summary>
public sealed class Card : Component<Card>
{
    public Prop<string> Title { get; set; } = "";

    public override void Render() =>
        Box(card =>
        {
            card.Text = "card";
            Label(title => Bind(() => title.Text = Title.Value));
            Content?.Invoke();
        });
}
