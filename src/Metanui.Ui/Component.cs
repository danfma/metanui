namespace Metanui.Ui;

/// <summary>
/// A component: props are C# properties set in the factory's lambda, then <see cref="Render" /> runs
/// once and builds into the ambient insertion point.
/// </summary>
/// <remarks>
/// <para>
/// A prop that <see cref="Render" /> binds is a <see cref="Prop{T}" />
/// (<c>public Prop&lt;string&gt; Label { get; set; } = "";</c>, read as <c>Label.Value</c> inside a
/// <c>Bind</c>): the consumer assigns a static value (<c>counter.Label = "Solo"</c>) or a reader
/// (<c>counter.Label = Live(() =&gt; $"#{count.Value}")</c>), and the binding follows the reader.
/// Assigning it writes no signal, so it works inside a <c>For</c> item or a <c>Show</c> branch, and a
/// static value reaches <see cref="Render" /> with no flush.
/// </para>
/// <para>
/// A plain property is read-once configuration: <see cref="Render" /> reads it once, right after
/// the props lambda. A <c>Bind</c> in the props lambda would be lost, so it throws, whether it targets
/// a <see cref="Prop{T}" /> or a plain property. Events stay plain delegates
/// (<c>public Action? OnRemove { get; set; }</c>).
/// </para>
/// <para>
/// Children go in <see cref="Content" />, a render prop that <see cref="Render" /> invokes where they
/// belong; no wrapper element is created.
/// </para>
/// </remarks>
public abstract class Component<TSelf>
    where TSelf : Component<TSelf>, new()
{
    /// <summary>
    /// Creates the component, sets its props in <paramref name="build" />, and mounts it at the
    /// ambient insertion point (<c>Card.Create(card =&gt; card.Title = "Hi")</c>).
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// <paramref name="build" /> creates a node: children go in <see cref="Content" />.
    /// </exception>
    public static void Create(Action<TSelf> build) => View.Mount(new TSelf(), build);

    /// <summary>Creates the component with no props and mounts it at the ambient insertion point.</summary>
    public static void Create() => View.Mount(new TSelf(), static _ => { });

    /// <summary>
    /// The children, built where <see cref="Render" /> invokes it (<c>Content?.Invoke()</c>), in the
    /// insertion point active there.
    /// </summary>
    public Action? Content { get; set; }

    /// <summary>Builds the component once, into the ambient insertion point.</summary>
    /// <remarks>
    /// A signal write in <c>Render</c> works at the top level but throws inside a <c>For</c> item or a
    /// <c>Show</c> branch, which build inside a computation: use <c>Prop</c>/<c>Live</c>, or write in
    /// event handlers.
    /// </remarks>
    public abstract void Render();
}
