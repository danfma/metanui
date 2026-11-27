using Metanui.Reactive;
using Metanui.Ui.Binding;
using Metanui.Ui.Building;
using Metanui.Ui.Regions;

namespace Metanui.Ui.Flow;

/// <summary>
/// The region of a <c>For</c>: item regions before one end anchor, kept in a doubly linked list in
/// their physical order. New items are rendered last; <see cref="Arrange" /> then moves the items
/// out of place, and a removed item removes itself when its owner is disposed.
/// </summary>
/// <remarks>
/// <see cref="Arrange" /> walks the new order backwards and moves an item only when its physical
/// successor differs from its successor in the new order: one move per item for a swap of two, n-1
/// for a reversal. It is O(n) per change with no longest-increasing-subsequence pass, so some
/// reorders move more items than the minimum (v1 gap).
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
        var port = Builder.Port;
        var anchor = port.CreateAnchor();
        var list = new ListRegion(port, Builder.Parent, anchor);

        Builder.AddRegion(list, anchor);
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

    internal void Unlink(ListItem item)
    {
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
    }

    /// <summary>
    /// Renders a new item last, before the list's end anchor, recording its top-level nodes; its
    /// owner's disposal discards it.
    /// </summary>
    private ListItem RenderItem<T>(Action<T> render, T value)
    {
        var item = new ListItem(Port, Parent, Port.CreateAnchor(), this);

        Port.Insert(Parent, item.End!, end);
        LinkBefore(item, null);
        Reactivity.OnCleanup(item.Discard);
        Builder.Run(Port, Parent, item.End, item, render, value);

        return item;
    }

    /// <summary>
    /// Moves the items into the order of <paramref name="items" />. Every item still linked is in
    /// <paramref name="items" />: the map disposed the removed ones before returning.
    /// </summary>
    private void Arrange(IReadOnlyList<ListItem> items)
    {
        if (ReferenceEquals(items, _arranged))
        {
            return;
        }

        _arranged = items;

        ListItem? next = null;

        for (var index = items.Count - 1; index >= 0; index--)
        {
            var item = items[index];

            if (item.Next != next)
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
}
