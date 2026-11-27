namespace Metanui.Ui;

/// <summary>
/// The platform operations the UI layer needs beyond element creation, on opaque node handles
/// (a DOM <c>Node</c> on the web, a control on Avalonia). Elements come from the platform's own
/// factories; the port creates text nodes and anchors and places nodes for <c>For</c>, <c>Show</c>,
/// components and <see cref="View.Render" />.
/// </summary>
public interface INodePort
{
    /// <summary>Creates a text node holding <paramref name="text" />.</summary>
    object CreateText(string text);

    /// <summary>Replaces the content of a text node created by <see cref="CreateText" />.</summary>
    void SetText(object text, string value);

    /// <summary>
    /// Creates an invisible placeholder node (a comment node on the web) that marks the end of a
    /// region whose nodes come and go.
    /// </summary>
    object CreateAnchor();

    /// <summary>
    /// Inserts <paramref name="node" /> into <paramref name="parent" /> before
    /// <paramref name="anchor" />, or last when <paramref name="anchor" /> is null. A node that is
    /// already a child of <paramref name="parent" /> moves (DOM <c>insertBefore</c> semantics).
    /// </summary>
    void Insert(object parent, object node, object? anchor);

    /// <summary>Removes <paramref name="node" />, a child of <paramref name="parent" />.</summary>
    void Remove(object parent, object node);
}
