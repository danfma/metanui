using Metanui.Ui.Regions;

namespace Metanui.Ui.Flow;

/// <summary>
/// One rendered <c>For</c> item: its nodes before its own end anchor, linked to its physical
/// neighbours in the list once the list has arranged it.
/// </summary>
internal sealed class ListItem(INodePort port, object parent, object end, ListRegion list)
    : Fragment(port, parent, end)
{
    internal ListItem? Previous;
    internal ListItem? Next;

    /// <summary>
    /// Whether the item is in the list's links. A new item is not until the list arranges it, and
    /// one whose map run failed never is.
    /// </summary>
    internal bool Linked;

    /// <summary>Runs when the item's owner is disposed: leaves the list and removes its nodes.</summary>
    internal void Discard()
    {
        list.Unlink(this);
        Remove();
    }
}
