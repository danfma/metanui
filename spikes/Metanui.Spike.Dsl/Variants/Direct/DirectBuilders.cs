using Metanui.Reactive;
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

    public static El Span(Action<HTMLElement> build) => Create("span", build);

    /// <summary>
    /// Keyed list: each item renders once, under its own root, and keeps its node while its key stays
    /// in the list; a removed key disposes its root and removes its node. The items live in a host
    /// element (the renderer port's anchors would remove it).
    /// </summary>
    public static El For<T>(Func<IReadOnlyList<T>> items, Func<T, int> key, Func<T, El> render) =>
        Create("div", host =>
        {
            var views = new Dictionary<int, ItemView>();

            // Items are created in the compute, under the effect: an apply has no owner, so a root
            // created there could never be disposed (the core rejects it).
            Reactivity.Effect(
                () =>
                {
                    var list = items();

                    return Reactivity.Untrack(() =>
                    {
                        Reconcile(host, views, list, key, render);

                        return list.Count;
                    });
                },
                (count, previous) => { }
            );
        });

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

    private static void Reconcile<T>(
        HTMLElement host,
        Dictionary<int, ItemView> views,
        IReadOnlyList<T> list,
        Func<T, int> key,
        Func<T, El> render
    )
    {
        var kept = new HashSet<int>();

        foreach (var item in list)
        {
            kept.Add(key(item));
        }

        foreach (var stale in views.Keys.Where(id => !kept.Contains(id)).ToList())
        {
            var view = views[stale];

            views.Remove(stale);
            host.RemoveChild(view.Node);
            view.Dispose();
        }

        foreach (var item in list)
        {
            var id = key(item);

            if (!views.TryGetValue(id, out var view))
            {
                view = RenderItem(item, render);
                views[id] = view;
            }

            host.AppendChild(view.Node);
        }
    }

    private static ItemView RenderItem<T>(T item, Func<T, El> render) =>
        Reactivity.Root(dispose =>
        {
            var parent = _current;

            _current = null;

            try
            {
                return new ItemView(render(item).Node, dispose);
            }
            finally
            {
                _current = parent;
            }
        });

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

/// <summary>A rendered list item: its node and the disposer of its root.</summary>
public sealed class ItemView(HTMLElement node, Action dispose)
{
    public HTMLElement Node => node;

    public void Dispose() => dispose();
}
