using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>
/// Option H (maintainer's proposal): elements are the platform objects themselves, and a binding is an
/// effect that writes a plain property. No property type carries the reactivity.
/// </summary>
public static class Bindings
{
    /// <summary>Explicit source: <c>count.BindTo(value =&gt; p.TextContent = ...)</c>.</summary>
    public static IDisposable BindTo<T>(this Signal<T> source, Action<T> apply) =>
        Reactivity.Effect(() => source.Value, (value, previous) => apply(value));

    /// <summary>Split: the expression is tracked, the write runs in the apply phase of the flush.</summary>
    public static IDisposable Bind<T>(Func<T> compute, Action<T> apply) =>
        Reactivity.Effect(compute, (value, previous) => apply(value));

    /// <summary>
    /// Fused: the write runs inside the tracked compute, now and on every change. Fine for a platform
    /// property; a signal write there throws (spec 0001, writes in a computation).
    /// </summary>
    public static IDisposable Bind(Action write) =>
        Reactivity.Effect(
            () =>
            {
                write();

                return 0;
            },
            (value, previous) => { }
        );

    public static void OnClick(this HTMLElement element, Action handler) =>
        element.AddEventListener("click", handler);
}
