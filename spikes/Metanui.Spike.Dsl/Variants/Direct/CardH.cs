using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Direct.Bindings;
using static Metanui.Spike.Dsl.Variants.Direct.DirectBuilders;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>Props backed by signals: plain properties for the consumer, reactive inside Render.</summary>
public sealed class CardH : Component<CardH>
{
    private readonly Signal<string> _title = Reactivity.Signal("");
    private readonly Signal<bool> _highlighted = Reactivity.Signal(false);

    public string Title
    {
        get => _title.Value;
        set => _title.Value = value;
    }

    public bool Highlighted
    {
        get => _highlighted.Value;
        set => _highlighted.Value = value;
    }

    public Action OnClose { get; set; } = () => { };

    public static El Card(Action<CardH> build) => Mount(new CardH(), build);

    public override El Render(El content) =>
        Section(section =>
        {
            Bind(() => section.ClassName = Highlighted ? "card highlighted" : "card");
            H2(heading => Bind(() => heading.TextContent = Title));
            Add(content);
            Button(close =>
            {
                close.TextContent = "close";
                close.OnClick(() => OnClose());
            });
        });
}

/// <summary>The maintainer's example: a plain prop, read once by Render.</summary>
public sealed class CounterH : Component<CounterH>
{
    public int Start { get; set; }

    public static El CounterBox(Action<CounterH> build) => Mount(new CounterH(), build);

    public override El Render(El content)
    {
        var count = Reactivity.Signal(Start);

        return Div(row =>
        {
            P(p => count.BindTo(value => p.TextContent = $"Count: {value} (Start = {Start})"));
            Button(button =>
            {
                button.TextContent = "+1";
                button.OnClick(() => count.Value++);
            });
        });
    }
}
