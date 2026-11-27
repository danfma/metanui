using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>The DOM <c>HTMLInputElement</c>.</summary>
[External]
public interface HTMLInputElement : HTMLElement
{
    /// <summary>The current value of the field.</summary>
    string Value { get; set; }

    /// <summary>Whether a checkbox or radio input is checked.</summary>
    bool Checked { get; set; }

    /// <summary>Whether the field ignores user interaction.</summary>
    bool Disabled { get; set; }
}
