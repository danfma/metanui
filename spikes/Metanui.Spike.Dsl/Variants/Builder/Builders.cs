using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Dsl.Core;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>
/// Option G (maintainer's idea): each element takes a builder lambda that runs once. A child created
/// inside the lambda appends itself to the element being built, found through an ambient scope.
/// </summary>
public static class Builders
{
    private static ElementScope? _current;

    public static El Section(Action<ElementScope> build) => Create("section", build);

    public static El H2(Action<ElementScope> build) => Create("h2", build);

    public static El P(Action<ElementScope> build) => Create("p", build);

    public static El Button(Action<ElementScope> build) => Create("button", build);

    /// <summary>Appends a part (a component, a hyperscript element) to the element being built.</summary>
    public static void Add(Part part) => part.AttachTo(CurrentScope().Node);

    /// <summary>Explicit source, value passed in: the apply runs when the source changes.</summary>
    public static void Bind<T>(Signal<T> source, Action<T> apply) =>
        Reactivity.Effect(() => source.Value, (value, previous) => apply(value));

    /// <summary>Explicit source, no value: the body runs untracked when the source changes.</summary>
    public static void Bind<T>(Signal<T> source, Action apply) =>
        Reactivity.Effect(() => source.Value, (value, previous) => apply());

    /// <summary>A reader to assign to a bindable property.</summary>
    public static Binding<T> Bind<T>(Func<T> read) => new(read);

    /// <summary>A text template whose signal holes stay live.</summary>
    public static Binding<string> Bind(TextTemplate template) => new(template.Render);

    private static El Create(string tagName, Action<ElementScope> build)
    {
        var node = Browser.Document.CreateElement(tagName);
        var parent = _current;
        var scope = new ElementScope(node);

        _current = scope;

        try
        {
            build(scope);
        }
        finally
        {
            _current = parent;
        }

        parent?.Node.AppendChild(node);

        return new El(node);
    }

    private static ElementScope CurrentScope() =>
        _current ?? throw new InvalidOperationException("Add runs only inside an element builder.");
}
