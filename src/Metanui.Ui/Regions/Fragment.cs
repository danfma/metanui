namespace Metanui.Ui.Regions;

/// <summary>
/// The top-level nodes and nested regions one build inserted, in order, optionally closed by an
/// end anchor.
/// </summary>
/// <remarks>
/// On disposal (<see cref="Remove" />, registered as a cleanup of the owner it was built under) a
/// fragment removes only its own nodes: each nested region is disposed with its own owner, which
/// is a child of that owner, and removes its nodes itself.
/// </remarks>
internal class Fragment(INodePort port, object parent, object? end) : Region(port, parent)
{
    private readonly List<object> _parts = [];

    internal object? End => end;

    internal override object? FirstNode => _parts.Count == 0 ? end : FirstNodeOf(_parts[0]);

    /// <summary>Records a node or a nested region, after the ones recorded before.</summary>
    internal void Add(object part) => _parts.Add(part);

    internal override void MoveBefore(object? anchor)
    {
        foreach (var part in _parts)
        {
            if (part is Region region)
            {
                region.MoveBefore(anchor);
            }
            else
            {
                Port.Insert(Parent, part, anchor);
            }
        }

        if (end is not null)
        {
            Port.Insert(Parent, end, anchor);
        }
    }

    /// <summary>Removes the fragment's own nodes and its end anchor.</summary>
    internal void Remove()
    {
        foreach (var part in _parts)
        {
            if (part is not Region)
            {
                Port.Remove(Parent, part);
            }
        }

        if (end is not null)
        {
            Port.Remove(Parent, end);
        }
    }

    private static object? FirstNodeOf(object part) =>
        part is Region region ? region.FirstNode : part;
}
