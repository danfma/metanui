using Metano.Annotations;
using Metano.Interop;
using Metanui.Ui.Building;
using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>
/// The HTML element factories, meant for <c>using static Metanui.Ui.Web.Html;</c>. Each creates its
/// element, runs <c>build</c> with it as the parent of what <c>build</c> creates, then inserts it at
/// the ambient insertion point, with no wrapper. <c>[NoContainer]</c>: each factory is a module
/// function in TypeScript, so a bundle keeps only the factories it uses.
/// </summary>
[NoContainer]
public static class Html
{
    /// <summary>Creates a <c>div</c>.</summary>
    public static void Div(Action<HTMLElement> build) => Create("div", build);

    /// <summary>Creates a <c>span</c>.</summary>
    public static void Span(Action<HTMLElement> build) => Create("span", build);

    /// <summary>Creates a <c>p</c>.</summary>
    public static void P(Action<HTMLElement> build) => Create("p", build);

    /// <summary>Creates an <c>h1</c>.</summary>
    public static void H1(Action<HTMLElement> build) => Create("h1", build);

    /// <summary>Creates an <c>h2</c>.</summary>
    public static void H2(Action<HTMLElement> build) => Create("h2", build);

    /// <summary>Creates an <c>h3</c>.</summary>
    public static void H3(Action<HTMLElement> build) => Create("h3", build);

    /// <summary>Creates a <c>section</c>.</summary>
    public static void Section(Action<HTMLElement> build) => Create("section", build);

    /// <summary>Creates a <c>button</c>.</summary>
    public static void Button(Action<HTMLButtonElement> build) => Create("button", build);

    /// <summary>Creates an <c>input</c>.</summary>
    public static void Input(Action<HTMLInputElement> build) => Create("input", build);

    /// <summary>Creates a <c>ul</c>.</summary>
    public static void Ul(Action<HTMLElement> build) => Create("ul", build);

    /// <summary>Creates an <c>li</c>.</summary>
    public static void Li(Action<HTMLElement> build) => Create("li", build);

    // `class`: Builder.Create takes reference types only, and an interface constraint alone admits a struct.
    private static void Create<TElement>(string tagName, Action<TElement> build)
        where TElement : class, HTMLElement =>
        // Metano #846: a cast to a type parameter constrained to an [External] interface should lower to a type assertion.
        Builder.Create(Browser.Document.CreateElement(tagName).UnsafeCast<TElement>(), build);
}
