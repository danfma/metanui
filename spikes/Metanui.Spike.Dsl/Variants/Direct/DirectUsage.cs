using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Direct.Bindings;
using static Metanui.Spike.Dsl.Variants.Direct.CardH;
using static Metanui.Spike.Dsl.Variants.Direct.CounterH;
using static Metanui.Spike.Dsl.Variants.Direct.DirectBuilders;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>Option H side by side: element bindings, signal-backed props, a plain prop.</summary>
public static class DirectUsage
{
    public static Part Gallery()
    {
        var count = Reactivity.Signal(0);
        var closed = Reactivity.Signal(0);

        return Section(section =>
        {
            section.ClassName = "variant";
            H2(heading => heading.TextContent = "H. Platform elements");

            P(p => count.BindTo(value => p.TextContent = $"BindTo: {value}"));
            P(p => Bind(() => $"Split: {count.Value}", text => p.TextContent = text));
            P(p => Bind(() => p.TextContent = $"Fused: {count.Value}"));

            Card(card =>
            {
                card.Title = "Static title";
                card.OnClose = () => closed.Value++;
                P(p => p.TextContent = "Static body");
            });

            Card(card =>
            {
                Bind(() => $"Count: {count.Value}", title => card.Title = title);
                Bind(() => count.Value > 5, on => card.Highlighted = on);
                card.OnClose = () => closed.Value++;
                P(p => Bind(() => p.TextContent = $"Closed {closed.Value} times"));
            });

            CounterBox(counter => counter.Start = 10);
            CounterBox(counter => Bind(() => count.Value + 100, start => counter.Start = start));

            // A fused Bind that writes a signal-backed prop throws at creation ("Writing to a signal
            // inside a computation is not allowed"), and the failed effect stays subscribed: it throws
            // again, out of the flush, on every change of what it read. Observed in Chrome; off here.
            // Card(card => Bind(() => card.Title = $"Fused prop {count.Value}"));

            Button(button =>
            {
                button.TextContent = "+1";
                button.OnClick(() => count.Value++);
            });
        });
    }
}
