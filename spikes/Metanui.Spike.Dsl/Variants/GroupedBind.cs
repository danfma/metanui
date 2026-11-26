using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants;

/// <summary>A property write, produced by a grouped binding on every run.</summary>
public sealed class Setter(Action<HTMLElement> apply)
{
    public void ApplyTo(HTMLElement element) => apply(element);

    public static Setter TextContent(string value) => new(element => element.TextContent = value);

    public static Setter ClassName(string value) => new(element => element.ClassName = value);
}

/// <summary>Option F (maintainer's idea): one effect per element re-applies a group of setters.</summary>
public abstract class BindingComponent : Component
{
    protected static El Bind(El element, Func<Setter[]> setters)
    {
        Reactivity.Effect(setters, (current, previous) =>
        {
            foreach (var setter in current)
            {
                setter.ApplyTo(element.Node);
            }
        });

        return element;
    }
}

public static class BindExtensions
{
    public static El Bind(this El element, Func<Setter[]> setters)
    {
        Reactivity.Effect(setters, (current, previous) =>
        {
            foreach (var setter in current)
            {
                setter.ApplyTo(element.Node);
            }
        });

        return element;
    }
}

public sealed class GroupedBindCounter : BindingComponent
{
    public override Part Render()
    {
        var count = Reactivity.Signal(0);

        return Section(
            Class("variant"),
            H2("F. Grouped Bind"),
            Bind(P(), () => [Setter.TextContent($"Count: {count.Value}")]),
            P()
                .Bind(() =>
                    [
                        Setter.TextContent("parity"),
                        Setter.ClassName(count.Value % 2 == 0 ? "even" : "odd"),
                    ]
                ),
            Button(OnClick(() => count.Value--), "-1"),
            Button(OnClick(() => count.Value++), "+1"),
            new Badge(() => count.Value > 5 ? "big" : "small")
        );
    }
}
