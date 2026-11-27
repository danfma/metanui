using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants.Components;

/// <summary>Consumer side of <see cref="CardC" />: one static card, one reactive card.</summary>
public static class CardCUsage
{
    public static Part Cards()
    {
        var count = Reactivity.Signal(0);
        var closed = Reactivity.Signal(0);

        return Section(
            Class("variant"),
            H2("C. Components"),
            // Idiomatic C#: new CardC(() => "Static title", onClose: ..., content: [P("Static body")]).
            // Metano 4.0.2 emits the named params array as one rest element (nested array), so the
            // spike skips the optional prop positionally instead.
            new CardC(() => "Static title", null, () => closed.Value++, P("Static body")),
            new CardC(
                title: () => $"Count: {count.Value}",
                highlighted: () => count.Value > 5,
                onClose: () => closed.Value++,
                P(Text(() => $"Closed {closed.Value} times"))
            ),
            Button(OnClick(() => count.Value++), "+1")
        );
    }
}
