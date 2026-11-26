using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants;

/// <summary>Option E (Reactor-style): children in the factory, attributes as modifiers after it.</summary>
public static class Modifiers
{
    public static El WithClass(this El element, string value)
    {
        element.Node.ClassName = value;

        return element;
    }

    public static El WithClass(this El element, Func<string> value)
    {
        Reactivity.Effect(value, (current, previous) => element.Node.ClassName = current);

        return element;
    }

    public static El WhenClicked(this El element, Action handler)
    {
        element.Node.AddEventListener("click", handler);

        return element;
    }
}

public static class FluentVariant
{
    public static Part Counter()
    {
        var count = Reactivity.Signal(0);

        return Section(
                H2("E. Fluent modifiers"),
                P(Attributes.Text(() => $"Count: {count.Value}")),
                P("parity").WithClass(() => count.Value % 2 == 0 ? "even" : "odd"),
                Button("-1").WhenClicked(() => count.Value--),
                Button("+1").WhenClicked(() => count.Value++),
                new Badge(() => count.Value > 5 ? "big" : "small")
            )
            .WithClass("variant");
    }
}
