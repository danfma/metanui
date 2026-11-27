using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Builder.Builders;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>A custom component in option G: each prop is one property, static or bound.</summary>
public sealed class CardG : BuilderComponent
{
    public Bindable<string> Title { get; set; } = "";

    public Bindable<bool> Highlighted { get; set; } = false;

    public Action<ClickEvent> OnClose { get; set; } = _ => { };

    public static El Card(Action<CardG> build) => Mount(new CardG(), build);

    public override El Render(El content) =>
        Section(section =>
        {
            section.ClassName = Bind(() => Highlighted.Get() ? "card highlighted" : "card");
            H2(heading => heading.TextContent = Title);
            Add(content);
            Button(close =>
            {
                close.TextContent = "close";
                close.OnClick = OnClose;
            });
        });
}
