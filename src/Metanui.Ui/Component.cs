namespace Metanui.Ui;

/// <summary>
/// A component: props are plain C# properties set in the factory's lambda, then
/// <see cref="Render" /> runs once and builds into the ambient insertion point.
/// </summary>
/// <remarks>
/// <para>
/// A reactive prop is backed by a signal (<c>get =&gt; _title.Value; set =&gt; _title.Value = value;</c>):
/// the consumer assigns a static value or binds it with the split
/// <see cref="View.Bind{T}(Func{T}, Action{T})" />, and the bindings in <see cref="Render" /> react.
/// The write queues like any signal write, so <see cref="Render" /> sees the value after the next flush.
/// Writing a signal inside a computation throws (spec 0001), so a signal-backed prop cannot be
/// assigned in a factory lambda that runs inside a <c>For</c> item or a <c>Show</c> branch; bind it
/// with the split <c>Bind</c>, or use a plain prop there.
/// </para>
/// <para>
/// A plain auto-property is init-only: <see cref="Render" /> reads it once, so a later write (a split
/// <c>Bind</c> applies at the end of the flush, after <see cref="Render" />) is lost silently.
/// </para>
/// <para>
/// Children go in <see cref="Content" />, a render prop that <see cref="Render" /> invokes where they
/// belong; no wrapper element is created. Each component exposes a one-line static factory over
/// <see cref="View.Mount{TComponent}" /> until Metano #832 lets a generic <c>Use</c> construct
/// <typeparamref name="TSelf" />.
/// </para>
/// </remarks>
public abstract class Component<TSelf>
    where TSelf : Component<TSelf>
{
    /// <summary>
    /// The children, built where <see cref="Render" /> invokes it (<c>Content?.Invoke()</c>), in the
    /// insertion point active there.
    /// </summary>
    public Action? Content { get; set; }

    /// <summary>Builds the component once, into the ambient insertion point.</summary>
    public abstract void Render();
}
