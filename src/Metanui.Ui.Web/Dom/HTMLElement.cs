using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>The DOM <c>HTMLElement</c>, reduced to what the factories and the samples use.</summary>
[External]
public interface HTMLElement : Node
{
    /// <summary>The element's text; writing it replaces every child with one text node.</summary>
    string TextContent { get; set; }

    /// <summary>The element's <c>class</c> attribute.</summary>
    string ClassName { get; set; }

    /// <summary>Registers <paramref name="listener" /> for the events of <paramref name="type" />.</summary>
    void AddEventListener(string type, Action listener);
}
