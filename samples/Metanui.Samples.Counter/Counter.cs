using Metanui.Reactive;
using Metanui.Ui;
using Metanui.Ui.Web;
using static Metanui.Ui.View;
using static Metanui.Ui.Web.Html;

namespace Metanui.Samples.Counter;

/// <summary>One counter: a label, its own count, and a remove button when the parent handles it.</summary>
public sealed class Counter : Component<Counter>
{
    public Prop<string> Label { get; set; } = "";

    /// <summary>Read once by <see cref="Render" />: without it, the counter has no remove button.</summary>
    public Action? OnRemove { get; set; }

    // Until Metano #832 (generic Use): see Component<TSelf>.
    public static void Create(Action<Counter> build) => Mount(new Counter(), build);

    public override void Render()
    {
        var count = Reactivity.Signal(0);
        // Metano #849: `OnRemove is { } onRemove` on a delegate reports MS0045.
        var onRemove = OnRemove;

        Div(row =>
        {
            row.ClassName = "counter";
            // Label.Value is read inside Bind, so a live label re-renders when its source changes.
            Span(label => Bind(() => label.TextContent = $"{Label.Value}: {count.Value}"));

            Button(minus =>
            {
                minus.TextContent = "-1";
                minus.OnClick(() => count.Update(c => c - 1));
            });

            Button(plus =>
            {
                plus.TextContent = "+1";
                plus.OnClick(() => count.Update(c => c + 1));
            });

            if (onRemove is not null)
            {
                Button(remove =>
                {
                    remove.TextContent = "remove";
                    remove.OnClick(onRemove);
                });
            }
        });
    }
}
