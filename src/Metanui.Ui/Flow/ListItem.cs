using Metanui.Ui.Regions;

namespace Metanui.Ui.Flow;

/// <summary>
/// One rendered <c>For</c> item: its nodes before its own end anchor, linked to its physical
/// neighbours in the list.
/// </summary>
internal sealed class ListItem(INodePort port, object parent, object end, ListRegion list)
    : Fragment(port, parent, end)
{
    internal ListItem? Previous;
    internal ListItem? Next;

    /// <summary>Runs when the item's owner is disposed: leaves the list and removes its nodes.</summary>
    internal void Discard()
    {
        list.Unlink(this);
        Remove();
    }
}
