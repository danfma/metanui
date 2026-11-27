using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>The click event a handler receives; the spike carries no data in it.</summary>
public sealed class ClickEvent
{
    public static readonly ClickEvent Instance = new();
}

/// <summary>
/// The <c>d</c> of <c>Div(d =&gt; { ... })</c>: a typed view of one element whose properties take a
/// static value or a binding.
/// </summary>
public sealed class ElementScope(HTMLElement node)
{
    private Bindable<string> _textContent = "";
    private Bindable<string> _className = "";

    public HTMLElement Node => node;

    public Bindable<string> TextContent
    {
        get => _textContent;
        set
        {
            _textContent = value;
            value.ApplyTo(text => node.TextContent = text);
        }
    }

    public Bindable<string> ClassName
    {
        get => _className;
        set
        {
            _className = value;
            value.ApplyTo(name => node.ClassName = name);
        }
    }

    public Action<ClickEvent> OnClick
    {
        set => node.AddEventListener("click", () => value(ClickEvent.Instance));
    }
}
