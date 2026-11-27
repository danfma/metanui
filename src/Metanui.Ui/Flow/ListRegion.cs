using Metanui.Reactive;
using Metanui.Ui.Binding;
using Metanui.Ui.Building;
using Metanui.Ui.Regions;

namespace Metanui.Ui.Flow;

/// <summary>
/// The region of a <c>For</c>: item regions before one end anchor, kept in a doubly linked list in
/// their physical order. A new item is rendered last, before the end anchor, and stays out of the
/// links; <see cref="Arrange" /> then places it and moves the kept items that are out of place. A
/// removed item removes itself when its owner is disposed.
/// </summary>
/// <remarks>
/// <see cref="Arrange" /> walks the new order backwards. New items that end the list stay where they
/// were rendered; any other new item moves once into place, so an insert anywhere moves no kept
/// item. A kept item moves only when its linked successor differs
/// from its successor in the new order: two moves for a swap of two items, n-1 for a reversal. The
/// walk is O(n) with no longest-increasing-subsequence pass, so some reorders of kept items move
/// more items than the minimum (v1 gap).
/// </remarks>
internal sealed class ListRegion(INodePort port, object parent, object end) : Region(port, parent)
{
    private ListItem? _first;
    private ListItem? _last;
    private IReadOnlyList<ListItem>? _arranged;

    internal override object? FirstNode => _first is null ? end : _first.FirstNode;

    /// <summary>
    /// Creates a list at the ambient insertion point whose items follow <paramref name="items" />,
    /// one per <paramref name="key" />, each rendered once by <paramref name="render" /> under the
    /// item owner of <see cref="Reactivity.Map{T, TKey, TResult}" />.
    /// </summary>
    internal static void Start<T, TKey>(
        Func<IReadOnlyList<T>> items,
        Func<T, TKey> key,
        Action<T> render
    )
        where TKey : notnull
    {
        var target = Builder.Target;
        var anchor = target.Port.CreateAnchor();
        var list = new ListRegion(target.Port, target.Parent, anchor);

        target.InsertRegion(list, anchor);
        Reactivity.OnCleanup(list.RemoveEnd);

        var mapped = Reactivity.Map(items, key, item => list.RenderItem(render, item));

        FusedBinding.Start(() => list.Arrange(mapped()));
    }

    internal override void MoveBefore(object? anchor)
    {
        for (var item = _first; item is not null; item = item.Next)
        {
            item.MoveBefore(anchor);
        }

        Port.Insert(Parent, end, anchor);
    }

    /// <summary>Takes <paramref name="item" /> out of the links; does nothing when it is not linked.</summary>
    internal void Unlink(ListItem item)
    {
        if (!item.Linked)
        {
            return;
        }

        if (item.Previous is null)
        {
            _first = item.Next;
        }
        else
        {
            item.Previous.Next = item.Next;
        }

        if (item.Next is null)
        {
            _last = item.Previous;
        }
        else
        {
            item.Next.Previous = item.Previous;
        }

        item.Previous = null;
        item.Next = null;
        item.Linked = false;
    }

    /// <summary>
    /// Renders a new item last, before the list's end anchor, recording its top-level nodes, and
    /// leaves it unlinked for <see cref="Arrange" />; its owner's disposal discards it.
    /// </summary>
    private ListItem RenderItem<T>(Action<T> render, T value)
    {
        var item = new ListItem(Port, Parent, Port.CreateAnchor(), this);

        Port.Insert(Parent, item.End!, end);
        Reactivity.OnCleanup(item.Discard);
        Builder.RunWith(Port, Parent, item.End, item, render, value);

        return item;
    }

    /// <summary>
    /// Moves the items into the order of <paramref name="items" /> and links the new ones. Every
    /// item still linked is in <paramref name="items" />: the map disposed the removed ones before
    /// returning.
    /// </summary>
    /// <remarks>
    /// The map renders new items in list order, each last, so the new items that end the list are
    /// already in place and are only linked (a first render or an append moves nothing). Any other
    /// new item sits after every kept item until the walk moves it before its successor.
    /// </remarks>
    private void Arrange(IReadOnlyList<ListItem> items)
    {
        if (ReferenceEquals(items, _arranged))
        {
            return;
        }

        _arranged = items;

        ListItem? next = null;
        var inNewTail = true;

        for (var index = items.Count - 1; index >= 0; index--)
        {
            var item = items[index];

            inNewTail = inNewTail && !item.Linked;

            if (inNewTail)
            {
                LinkBefore(item, next);
            }
            else if (IsOutOfPlace(item, next))
            {
                item.MoveBefore(next is null ? end : next.FirstNode);
                Unlink(item);
                LinkBefore(item, next);
            }

            next = item;
        }
    }

    /// <summary>Links <paramref name="item" /> before <paramref name="next" />, or last when it is null.</summary>
    private void LinkBefore(ListItem item, ListItem? next)
    {
        var previous = next is null ? _last : next.Previous;

        item.Previous = previous;
        item.Next = next;
        item.Linked = true;

        if (previous is null)
        {
            _first = item;
        }
        else
        {
            previous.Next = item;
        }

        if (next is null)
        {
            _last = item;
        }
        else
        {
            next.Previous = item;
        }
    }

    private void RemoveEnd() => Port.Remove(Parent, end);

    /// <summary>A new item, or a kept one whose linked successor is not its new successor.</summary>
    private static bool IsOutOfPlace(ListItem item, ListItem? next) =>
        !item.Linked || item.Next != next;
}
