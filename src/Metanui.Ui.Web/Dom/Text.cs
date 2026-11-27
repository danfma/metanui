using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>The DOM <c>Text</c> node.</summary>
[External]
public interface Text : Node
{
    /// <summary>The text the node holds.</summary>
    string Data { get; set; }
}
