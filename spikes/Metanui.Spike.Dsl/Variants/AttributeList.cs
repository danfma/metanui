using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants;

/// <summary>Option C: attributes and children in one list, attributes first, as in HTML.</summary>
public static class AttributeListVariant
{
    public static Part Counter()
    {
        var count = Reactivity.Signal(0);

        return Section(
            Class("variant"),
            H2("C. Attribute list"),
            P(Text(() => $"Count: {count.Value}")),
            P(Class(() => count.Value % 2 == 0 ? "even" : "odd"), "parity"),
            Button(OnClick(() => count.Value--), "-1"),
            Button(OnClick(() => count.Value++), "+1"),
            new Badge(() => count.Value > 5 ? "big" : "small")
        );
    }
}
