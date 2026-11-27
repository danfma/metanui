using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>
/// The DOM <c>Node</c>, reduced to what the adapter uses. Like every type in this namespace it is
/// <c>[External]</c>: it gives C# a type and emits nothing, so the name resolves to lib.dom. The DOM
/// exists only in the browser; on .NET these types compile but have no implementation.
/// </summary>
[External]
public interface Node
{
    /// <summary>Inserts <paramref name="node" /> before <paramref name="child" />, or last when it is null.</summary>
    Node InsertBefore(Node node, Node? child);

    /// <summary>Removes <paramref name="child" />, a child of this node.</summary>
    Node RemoveChild(Node child);
}
