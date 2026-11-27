using Metanui.Reactive;
using Metanui.Ui;
using Metanui.Ui.Web;
using static Metanui.Ui.View;
using static Metanui.Ui.Web.Html;

namespace Metanui.Samples.Counter;

/// <summary>Adds counters on demand; each one keeps its state while others come and go.</summary>
public sealed class CounterList : Component<CounterList>
{
    // Metano #832
    public static void Create(Action<CounterList> build) => Mount(new CounterList(), build);

    public override void Render()
    {
        var nextId = 1;
        var entries = Reactivity.Signal<IReadOnlyList<CounterEntry>>([]);

        Section(section =>
        {
            section.ClassName = "counter-list";
            H2(heading => heading.TextContent = "Counters");
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
