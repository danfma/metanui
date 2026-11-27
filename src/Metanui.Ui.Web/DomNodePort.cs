using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>
/// The <see cref="INodePort" /> over the DOM: text nodes, comment anchors and
/// <c>insertBefore</c>/<c>removeChild</c>. The handles it receives are DOM nodes.
/// </summary>
public sealed class DomNodePort : INodePort
{
    public object CreateText(string text) => Browser.Document.CreateTextNode(text);

    public void SetText(object text, string value) => ((Text)text).Data = value;

    public object CreateAnchor() => Browser.Document.CreateComment("");

    public void Insert(object parent, object node, object? anchor) =>
        ((Node)parent).InsertBefore((Node)node, (Node?)anchor);

    public void Remove(object parent, object node) => ((Node)parent).RemoveChild((Node)node);
}
