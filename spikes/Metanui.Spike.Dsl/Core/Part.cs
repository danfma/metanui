using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Dsl.Core;

/// <summary>
/// Anything an element factory accepts in its argument list: a child (element, text, component) or
/// an attribute. Each part attaches itself to the parent element once; reactive parts bind an effect.
/// </summary>
public abstract class Part
{
    public abstract void AttachTo(HTMLElement parent);

    /// <summary>A plain string is a static text child.</summary>
    public static implicit operator Part(string text) => new StaticText(text);

    // Nested: a subclass in its own module would import Part while Part imports it (MS0005).
    private sealed class StaticText(string text) : Part
    {
        public override void AttachTo(HTMLElement parent) =>
            parent.AppendChild(Browser.Document.CreateTextNode(text));
    }
}

public sealed class ReactiveTextPart(Func<string> text) : Part
{
    public override void AttachTo(HTMLElement parent)
    {
        var node = Browser.Document.CreateTextNode("");

        Reactivity.Effect(text, (value, previous) => node.Data = value);
        parent.AppendChild(node);
    }
}

/// <summary>An attribute: applies itself to the element it is passed to.</summary>
public sealed class AttributePart(Action<HTMLElement> apply) : Part
{
    public override void AttachTo(HTMLElement parent) => apply(parent);
}

/// <summary>A created DOM element; as a part, it appends itself to its parent.</summary>
public sealed class El(HTMLElement node) : Part
{
    public HTMLElement Node => node;

    public override void AttachTo(HTMLElement parent) => parent.AppendChild(node);

    public static El Create(string tagName, Part[] parts)
    {
        var element = new El(Browser.Document.CreateElement(tagName));

        foreach (var part in parts)
        {
            part.AttachTo(element.Node);
        }

        return element;
    }
}

/// <summary>
/// Class component: the constructor takes the props, Render runs once (fine-grained: no re-render),
/// under the owner that attaches it.
/// </summary>
public abstract class Component : Part
{
    public abstract Part Render();

    public override void AttachTo(HTMLElement parent) => Render().AttachTo(parent);
}
