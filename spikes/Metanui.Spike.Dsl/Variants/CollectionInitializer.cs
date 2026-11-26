using System.Collections;
using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;

namespace Metanui.Spike.Dsl.Variants.Initializers;

/// <summary>Option D: attributes in the constructor, children in a collection initializer.</summary>
public abstract class ElementBuilder(string tagName, Part[] attributes) : Part, IEnumerable<Part>
{
    private readonly List<Part> _children = [];

    public void Add(Part child) => _children.Add(child);

    public IEnumerator<Part> GetEnumerator() => _children.GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public override void AttachTo(HTMLElement parent)
    {
        var element = El.Create(tagName, attributes);

        foreach (var child in _children)
        {
            child.AttachTo(element.Node);
        }

        element.AttachTo(parent);
    }
}

public sealed class Section(params Part[] attributes) : ElementBuilder("section", attributes);

public sealed class H2(params Part[] attributes) : ElementBuilder("h2", attributes);

public sealed class P(params Part[] attributes) : ElementBuilder("p", attributes);

public sealed class Button(params Part[] attributes) : ElementBuilder("button", attributes);

public static class CollectionInitializerVariant
{
    public static Part Counter()
    {
        var count = Reactivity.Signal(0);

        return new Section(Class("variant"))
        {
            new H2 { "D. Collection initializer" },
            new P { Text(() => $"Count: {count.Value}") },
            new P(Class(() => count.Value % 2 == 0 ? "even" : "odd")) { "parity" },
            new Button(OnClick(() => count.Value--)) { "-1" },
            new Button(OnClick(() => count.Value++)) { "+1" },
            new Badge(() => count.Value > 5 ? "big" : "small"),
        };
    }
}
