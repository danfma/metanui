using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Builder.Builders;
using static Metanui.Spike.Dsl.Variants.Builder.CardG;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>Consumer side of <see cref="CardG" />: one static card, one reactive card.</summary>
public static class CardGUsage
{
    public static Part Cards()
    {
        var count = Reactivity.Signal(0);
        var closed = Reactivity.Signal(0);

        return Section(section =>
        {
            section.ClassName = "variant";
            H2(heading => heading.TextContent = "G. Components");

            Card(card =>
            {
                card.Title = "Static title";
                card.OnClose = _ => closed.Value++;
                P(p => p.TextContent = "Static body");
            });

            Card(card =>
            {
                card.Title = Bind(() => $"Count: {count.Value}");
                card.Highlighted = Bind(() => count.Value > 5);
                card.OnClose = _ => closed.Value++;
                P(p => p.TextContent = Bind(() => $"Closed {closed.Value} times"));
            });

            Button(button =>
            {
                button.TextContent = "+1";
                button.OnClick = _ => count.Value++;
            });
        });
    }
}
