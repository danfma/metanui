using Metanui.Reactive;
using Metanui.Ui.Binding;
using Metanui.Ui.Building;
using Metanui.Ui.Flow;
using Metanui.Ui.Rendering;

namespace Metanui.Ui;

/// <summary>
/// The DSL entry points, meant for <c>using static Metanui.Ui.View;</c>: bindings, text, control
/// flow, component mounting and rendering. Named <c>View</c>, not <c>Ui</c>, so that from any
/// namespace under <c>Metanui</c> the name does not resolve to the <c>Metanui.Ui</c> namespace.
/// </summary>
public static class View
{
    /// <summary>
    /// Fused binding: runs <paramref name="write" /> now, tracked, and again whenever what it read
    /// changes, in the compute phase. Use it to write platform properties
    /// (<c>Bind(() =&gt; label.TextContent = $"Count: {count.Value}")</c>).
    /// </summary>
    /// <remarks>
    /// The write runs inside a computation, so writing a signal there, which includes a
    /// signal-backed component prop, throws (spec 0001); use
    /// <see cref="Bind{T}(Func{T}, Action{T})" /> for those.
    /// </remarks>
    /// <returns>The effect's handle, which disposes the binding before its owner does.</returns>
    public static IDisposable Bind(Action write) => FusedBinding.Start(write);

    /// <summary>
    /// Split binding: <paramref name="compute" /> is tracked; <paramref name="apply" /> writes its
    /// result in the apply phase, at the end of the flush, and skips a result equal to the previous
    /// one (<see cref="EqualityComparer{T}.Default" />). Use it for signal-backed props, and when the
    /// result changes less often than its sources.
    /// </summary>
    /// <returns>The effect's handle, which disposes the binding before its owner does.</returns>
    public static IDisposable Bind<T>(Func<T> compute, Action<T> apply) =>
        Reactivity.Effect(compute, new SplitBinding<T>(apply).Apply);

    /// <summary>Inserts a static text node at the ambient insertion point.</summary>
    public static void Text(string value) => Builder.Add(Builder.Target.Port.CreateText(value));

    /// <summary>
    /// Inserts a text node at the ambient insertion point whose content follows
    /// <paramref name="value" />, through a fused binding.
    /// </summary>
    public static void Text(Func<string> value)
    {
        var port = Builder.Target.Port;
        var node = port.CreateText("");

        Builder.Add(node);
        FusedBinding.Start(() => port.SetText(node, value()));
    }

    /// <summary>
    /// Renders each item of <paramref name="items" /> once, keyed by the item itself
    /// (<see cref="EqualityComparer{T}.Default" />), at the ambient insertion point; see
    /// <see cref="For{T, TKey}" />.
    /// </summary>
    public static void For<T>(Func<IReadOnlyList<T>> items, Action<T> render)
        where T : notnull => ListRegion.Start(items, static item => item, render);

    /// <summary>
    /// Renders each item of <paramref name="items" /> once per <paramref name="key" />, at the
    /// ambient insertion point, with no wrapper element.
    /// </summary>
    /// <remarks>
    /// <paramref name="render" /> runs untracked under the item's own owner, which lives while the
    /// key stays in the list (<see cref="Reactivity.Map{T, TKey, TResult}" />): a kept item keeps its
    /// nodes and state and moves with them; a removed item is disposed and its nodes removed.
    /// <paramref name="render" /> runs inside a computation, so a signal write there throws.
    /// In TypeScript, <see cref="IReadOnlyList{T}" /> is metano-runtime's list: hand-written TS passes
    /// <c>List.adopt(array, { fixedSize: true })</c>.
    /// </remarks>
    public static void For<T, TKey>(
        Func<IReadOnlyList<T>> items,
        Func<T, TKey> key,
        Action<T> render
    )
        where TKey : notnull => ListRegion.Start(items, key, render);

    /// <summary>
    /// Shows <paramref name="then" /> while <paramref name="when" /> is true and
    /// <paramref name="otherwise" />, if any, while it is false, at the ambient insertion point. Each
    /// branch is built under its own root, disposed, with its nodes removed, when the condition's
    /// result changes. A source change that keeps the result rebuilds nothing.
    /// </summary>
    public static void Show(Func<bool> when, Action then, Action? otherwise = null) =>
        SwitchRegion.Start(when, then, otherwise);

    /// <summary>
    /// Mounts <paramref name="component" />: <paramref name="build" /> sets its props and
    /// <see cref="Component{TSelf}.Content" />, then <see cref="Component{TSelf}.Render" /> runs once
    /// at the ambient insertion point. Components run under the current owner; they are not roots.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// <paramref name="build" /> creates a node: children go in <c>Content</c>.
    /// </exception>
    public static void Mount<TComponent>(TComponent component, Action<TComponent> build)
        where TComponent : Component<TComponent>
    {
        Builder.RunRejectingChildren(build, component);
        component.Render();
    }

    /// <summary>
    /// Builds <paramref name="build" /> into <paramref name="container" /> through
    /// <paramref name="port" />, under a new root.
    /// </summary>
    /// <returns>A handle that disposes the whole tree and removes its nodes from the container.</returns>
    public static IDisposable Render(Action build, object container, INodePort port) =>
        RenderedView.Start(build, container, port);
}
