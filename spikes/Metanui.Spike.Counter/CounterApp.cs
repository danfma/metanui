using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Counter.Ui;

namespace Metanui.Spike.Counter;

public static class CounterApp
{
    public static Node Counter()
    {
        var count = Reactivity.Signal(0);
        var doubled = Reactivity.Computed(() => count.Value * 2);

        return Html.Element(
            "div",
            Html.Element("h1", Html.Text(() => $"Count: {count.Value}")),
            Html.Element("p", Html.Text(() => $"Doubled: {doubled.Value}")),
            Html.Button("-1", () => count.Value--),
            Html.Button("+1", () => count.Value++)
        );
    }

    public static void Main()
    {
        Reactivity.UseScheduler(new MicrotaskScheduler());
        Html.Mount(Counter, Browser.Document.Body);
    }
}
