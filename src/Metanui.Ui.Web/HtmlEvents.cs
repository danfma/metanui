using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>
/// Event extensions on the DOM elements, meant to be called in an element's builder.
/// </summary>
/// <remarks>
/// <para>
/// A listener is never removed: it lives as long as its element, and disposing the view (or the
/// <c>For</c> item or <c>Show</c> branch) that built the element only removes the element. A
/// handler that captures long-lived state keeps it alive while the element is referenced.
/// </para>
/// <para>
/// Registering the same delegate twice for the same event on one element is a no-op in browsers
/// (<c>addEventListener</c> ignores a duplicate), so the handler still runs once per event.
/// </para>
/// <para>
/// Handlers dispatched by the browser run outside every computation, so they may write signals.
/// </para>
/// </remarks>
public static class HtmlEvents
{
    /// <summary>Runs <paramref name="handler" /> on every <c>click</c> of <paramref name="element" />.</summary>
    public static void OnClick(this HTMLElement element, Action handler) =>
        element.AddEventListener("click", handler);

    /// <summary>
    /// Runs <paramref name="handler" /> with the field's current value on every <c>input</c> event of
    /// <paramref name="input" />.
    /// </summary>
    public static void OnInput(this HTMLInputElement input, Action<string> handler) =>
        input.AddEventListener("input", () => handler(input.Value));
}
