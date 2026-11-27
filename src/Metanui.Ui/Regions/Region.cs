namespace Metanui.Ui.Regions;

/// <summary>
/// A run of sibling nodes that the UI layer moves as a group: a <c>For</c> item, a list, a
/// <c>Show</c>. Each kind knows its current nodes, so an enclosing region can move it without the
/// port navigating siblings.
/// </summary>
internal abstract class Region(INodePort port, object parent)
{
    protected INodePort Port => port;

    protected object Parent => parent;

    /// <summary>The region's first node in the platform tree; null for an empty region with no anchor.</summary>
    internal abstract object? FirstNode { get; }

    /// <summary>Re-inserts every node of the region, in order, before <paramref name="anchor" />.</summary>
    internal abstract void MoveBefore(object? anchor);
}
