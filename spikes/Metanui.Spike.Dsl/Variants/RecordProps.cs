using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Dsl.Core;

namespace Metanui.Spike.Dsl.Variants;

/// <summary>A prop value: static, or bound to the graph. A lambda cannot convert to it implicitly (CS1660).</summary>
public sealed class Prop<T>
{
    private Prop(T value, Func<T>? read)
    {
        Value = value;
        Read = read;
    }

    public T Value { get; }

    public Func<T>? Read { get; }

    public static Prop<T> Bound(Func<T> read) => new(default!, read);

    public static implicit operator Prop<T>(T value) => new(value, null);

    public void ApplyTo(Action<T> write)
    {
        if (Read is null)
        {
            write(Value);

            return;
        }

        Reactivity.Effect(Read, (current, previous) => write(current));
    }
}

/// <summary>Option A: one props object per element, every attribute enumerated as a property.</summary>
public sealed class Props
{
    public Prop<string>? Class { get; init; }

    public Action? OnClick { get; init; }

    public void ApplyTo(HTMLElement element)
    {
        Class?.ApplyTo(value => element.ClassName = value);

        if (OnClick is not null)
        {
            element.AddEventListener("click", OnClick);
        }
    }
}

public static class PropsElements
{
    public static Prop<T> Bind<T>(Func<T> read) => Prop<T>.Bound(read);

    public static El Element(string tagName, Props props, Part[] children)
    {
        var element = El.Create(tagName, children);

        props.ApplyTo(element.Node);

        return element;
    }

    public static El Section(Props props, params Part[] children) =>
        Element("section", props, children);

    public static El H2(Props props, params Part[] children) => Element("h2", props, children);

    public static El P(Props props, params Part[] children) => Element("p", props, children);

    public static El Button(Props props, params Part[] children) =>
        Element("button", props, children);
}

public static class RecordPropsVariant
{
    public static Part Counter()
    {
        var count = Reactivity.Signal(0);

        return PropsElements.Section(
            new Props { Class = "variant" },
            PropsElements.H2(new Props(), "A. Props object"),
            PropsElements.P(new Props(), Attributes.Text(() => $"Count: {count.Value}")),
            PropsElements.P(
                new Props
                {
                    Class = PropsElements.Bind(() => count.Value % 2 == 0 ? "even" : "odd"),
                },
                "parity"
            ),
            PropsElements.Button(new Props { OnClick = () => count.Value-- }, "-1"),
            PropsElements.Button(new Props { OnClick = () => count.Value++ }, "+1"),
            new Badge(() => count.Value > 5 ? "big" : "small")
        );
    }
}
