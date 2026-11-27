using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>The DOM <c>HTMLButtonElement</c>.</summary>
[External]
public interface HTMLButtonElement : HTMLElement
{
    /// <summary>Whether the button ignores user interaction.</summary>
    bool Disabled { get; set; }
}
