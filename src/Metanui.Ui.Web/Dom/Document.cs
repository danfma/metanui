using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>The DOM <c>Document</c>, as the node factory.</summary>
[External]
public interface Document
{
    /// <summary>Creates an element named <paramref name="tagName" />.</summary>
    HTMLElement CreateElement(string tagName);

    /// <summary>Creates a text node holding <paramref name="data" />.</summary>
    Text CreateTextNode(string data);

    /// <summary>Creates a comment node holding <paramref name="data" />.</summary>
    Comment CreateComment(string data);
}
