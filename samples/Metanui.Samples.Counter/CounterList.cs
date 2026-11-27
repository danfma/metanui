using Metanui.Reactive;
using Metanui.Ui;
using Metanui.Ui.Web;
using static Metanui.Ui.View;
using static Metanui.Ui.Web.Html;

namespace Metanui.Samples.Counter;

/// <summary>Adds counters on demand; each one keeps its state while others come and go.</summary>
public sealed class CounterList : Component<CounterList>
{
    private readonly Signal<IReadOnlyList<CounterEntry>> _entries = Reactivity.Signal<
        IReadOnlyList<CounterEntry>
    >([]);

    private int _nextId = 1;

    // Until Metano #832 (generic Use): see Component<TSelf>.
    public static void Create(Action<CounterList> build) => Mount(new CounterList(), build);

    /// <summary>Creates a list with no props.</summary>
    public static void Create() => Create(static _ => { });

    public override void Render() =>
        Section(section =>
        {
            section.ClassName = "counter-list";
            H2(heading => heading.TextContent = "Counters");
            P(summary => Bind(() => summary.TextContent = $"In list: {_entries.Value.Count}"));

            Button(add =>
            {
                add.TextContent = "Add counter";
                add.OnClick(AddCounter);
            });

            For(
                () => _entries.Value,
                entry => entry.Id,
                entry =>
                    Counter.Create(counter =>
                    {
                        counter.Label = $"#{entry.Id}";
                        counter.OnRemove = () => RemoveCounter(entry.Id);
                    })
            );
        });

    // Metano #782: local functions are not transpiled, so these are private methods.
    private void AddCounter()
    {
        var entry = new CounterEntry(_nextId);

        _nextId++;
        _entries.Update(list => [.. list, entry]);
    }

    private void RemoveCounter(int id) =>
        _entries.Update(list => [.. list.Where(entry => entry.Id != id)]);
}
