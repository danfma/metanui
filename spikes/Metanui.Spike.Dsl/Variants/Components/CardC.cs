using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants.Components;

/// <summary>
/// A custom component in option C: the props are constructor parameters. A reactive prop is a Func,
/// so a static value is wrapped in a lambda; an optional prop has a default, and the children come
/// last as params.
/// </summary>
public sealed class CardC(
    Func<string> title,
    Func<bool>? highlighted = null,
    Action? onClose = null,
    params Part[] content
) : Component
{
    public override Part Render() =>
        Section(
            Class(() => highlighted?.Invoke() == true ? "card highlighted" : "card"),
            H2(Text(title)),
            Div(content),
            Button(OnClick(() => onClose?.Invoke()), "close")
        );
}
