using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Dsl.Core;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>Builder lambdas over the platform element itself; children attach through an ambient parent.</summary>
public static class DirectBuilders
{
    private static HTMLElement? _current;

    public static El Section(Action<HTMLElement> build) => Create("section", build);

    public static El Div(Action<HTMLElement> build) => Create("div", build);

    public static El H2(Action<HTMLElement> build) => Create("h2", build);

    public static El P(Action<HTMLElement> build) => Create("p", build);

    public static El Button(Action<HTMLElement> build) => Create("button", build);

    public static void Add(Part part) =>
        part.AttachTo(
            _current
                ?? throw new InvalidOperationException("Add runs only inside an element builder.")
        );

    /// <summary>Props and children first (children collected in a detached element), then Render.</summary>
    public static El Mount<TComponent>(TComponent component, Action<TComponent> build)
        where TComponent : Component<TComponent>
    {
        var parent = _current;
        var content = Browser.Document.CreateElement("div");

        _current = content;

        try
        {
            build(component);
        }
        finally
        {
            _current = null;
        }

        try
        {
            var root = component.Render(new El(content));

            parent?.AppendChild(root.Node);

            return root;
        }
        finally
        {
            _current = parent;
        }
    }

    private static El Create(string tagName, Action<HTMLElement> build)
    {
        var node = Browser.Document.CreateElement(tagName);
        var parent = _current;

        _current = node;

        try
        {
            build(node);
        }
        finally
        {
            _current = parent;
        }

        parent?.AppendChild(node);

        return new El(node);
    }
}
