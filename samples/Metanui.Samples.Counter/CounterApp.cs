using Metanui.Reactive;
using Metanui.Ui.Web;
using Metanui.Ui.Web.Dom;
using static Metanui.Ui.View;
using static Metanui.Ui.Web.Html;

namespace Metanui.Samples.Counter;

/// <summary>
/// The sample app: a standalone counter whose label follows a text field, and a counter list.
/// </summary>
public static class CounterApp
{
    /// <summary>Renders the app into <paramref name="container" />.</summary>
    /// <returns>A handle that disposes the app and removes its nodes.</returns>
    public static IDisposable Start(HTMLElement container) => WebApp.Render(Build, container);

    /// <summary>Builds the app at the ambient insertion point.</summary>
    public static void Build()
    {
        var name = Reactivity.Signal("Solo");

        H1(heading => heading.TextContent = "Metanui counters");

        Input(field =>
        {
            field.Value = name.Value;
            field.OnInput(value => name.Value = value);
        });

        Counter.Create(counter => counter.Label = Live(() => name.Value));
        CounterList.Create();
    }
}
