using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Direct.Bindings;
using static Metanui.Spike.Dsl.Variants.Direct.DirectBuilders;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>One counter: a label prop, its own count, and a remove callback.</summary>
public sealed class Counter : Component<Counter>
{
    /// <summary>
    /// Counters rendered and not yet disposed, to check that removal disposes. A plain field: Render
    /// runs inside the list's computation, where a signal write throws.
    /// </summary>
    public static int Live;

    public string Label { get; set; } = "";

    public Action OnRemove { get; set; } = () => { };

    public static El Create(Action<Counter> build) => Mount(new Counter(), build);

    public override El Render(El content)
    {
        var count = Reactivity.Signal(0);

        Live++;
        Reactivity.OnCleanup(() => Live--);

        return Div(row =>
        {
            row.ClassName = "counter-row";
            Span(label => Bind(() => label.TextContent = $"{Label}: {count.Value} "));
            Button(minus =>
            {
                minus.TextContent = "-1";
                minus.OnClick(() => count.Value--);
            });
            Button(plus =>
            {
                plus.TextContent = "+1";
                plus.OnClick(() => count.Value++);
            });
            Button(remove =>
            {
                remove.TextContent = "remove";
                remove.OnClick(() => OnRemove());
            });
        });
    }
}

/// <summary>A list key: the id a counter keeps while it stays in the list.</summary>
public sealed class CounterEntry(int id)
{
    public int Id => id;
}

/// <summary>Adds counters on demand; each one keeps its state while others come and go.</summary>
public sealed class CounterList : Component<CounterList>
{
    public static El Create(Action<CounterList> build) => Mount(new CounterList(), build);

    public override El Render(El content)
    {
        var nextId = 1;
        var entries = Reactivity.Signal<IReadOnlyList<CounterEntry>>([]);

        return Section(section =>
        {
            section.ClassName = "variant";
            H2(heading => heading.TextContent = "H. CounterList");
            P(summary => Bind(() => summary.TextContent = $"In list: {entries.Value.Count}"));
            Button(add =>
            {
                add.TextContent = "Add counter";
                add.OnClick(() => entries.Value = [.. entries.Value, new CounterEntry(nextId++)]);
            });
            For(
                () => entries.Value,
                entry => entry.Id,
                entry =>
                    Counter.Create(counter =>
                    {
                        counter.Label = $"#{entry.Id}";
                        counter.OnRemove = () =>
                            entries.Value = [.. entries.Value.Where(other => other.Id != entry.Id)];
                    })
            );
        });
    }
}
