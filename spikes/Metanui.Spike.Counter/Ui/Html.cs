using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Counter.Ui;

/// <summary>
/// A minimal fine-grained DSL: each call creates its DOM node once, and only the parts passed as
/// functions are bound to the graph (an effect writes the node when its value changes). No virtual
/// DOM and no re-render.
/// </summary>
public static class Html
{
    public static HTMLElement Element(string tagName, params Node[] children)
    {
        var element = Browser.Document.CreateElement(tagName);

        foreach (var child in children)
        {
            element.AppendChild(child);
        }

        return element;
    }

    /// <summary>A static text node.</summary>
    public static Node Text(string text) => Browser.Document.CreateTextNode(text);

    /// <summary>A text node bound to <paramref name="text" />, written in the apply phase.</summary>
    public static Node Text(Func<string> text)
    {
        var node = Browser.Document.CreateTextNode("");

        Reactivity.Effect(text, (value, previous) => node.Data = value);

        return node;
    }

    public static HTMLElement Button(string label, Action onClick)
    {
        var button = Browser.Document.CreateElement("button");

        button.TextContent = label;
        button.AddEventListener("click", onClick);

        return button;
    }

    /// <summary>Renders <paramref name="app" /> into <paramref name="container" /> under a root; returns its disposer.</summary>
    public static Action Mount(Func<Node> app, HTMLElement container) =>
        Reactivity.Root(dispose =>
        {
            container.AppendChild(app());

            return dispose;
        });
}
