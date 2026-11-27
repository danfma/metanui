namespace Metanui.Ui;

/// <summary>
/// The platform operations the UI layer needs beyond element creation, on opaque node handles (for
/// example a DOM <c>Node</c> on the web, a control on Avalonia). Elements come from the platform's
/// own factories; the port creates text nodes and anchors and places nodes for <c>For</c>,
/// <c>Show</c>, components and <see cref="View.Render" />.
/// </summary>
public interface INodePort
{
    /// <summary>Creates a detached text node holding <paramref name="text" />.</summary>
    object CreateText(string text);

    /// <summary>Replaces the content of a text node created by <see cref="CreateText" />.</summary>
    void SetText(object text, string value);

    /// <summary>
    /// Creates a detached placeholder node that is invisible to the user and marks a position among
    /// its siblings (on the web, for example, an empty comment node). Regions whose nodes come and
    /// go insert them before their anchor.
    /// </summary>
    object CreateAnchor();

    /// <summary>
    /// Inserts <paramref name="node" /> into <paramref name="parent" /> before
    /// <paramref name="anchor" />, a child of <paramref name="parent" />; a null
    /// <paramref name="anchor" /> appends it. When <paramref name="node" /> is already a child of
    /// <paramref name="parent" />, it is repositioned before <paramref name="anchor" /> (or last),
    /// not duplicated.
    /// </summary>
    void Insert(object parent, object node, object? anchor);

    /// <summary>Removes <paramref name="node" />, a child of <paramref name="parent" />.</summary>
    void Remove(object parent, object node);
}
