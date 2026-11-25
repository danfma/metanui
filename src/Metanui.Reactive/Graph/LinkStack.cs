namespace Metanui.Reactive.Graph;

/// <summary>
/// Shared explicit stack <see cref="DependencyGraph" /> keeps while it walks branching paths of the
/// graph (alien-signals <c>Stack&lt;T&gt;</c>, without a node per frame). The buffer grows by doubling
/// and is reused, so a steady-state walk allocates nothing.
/// </summary>
/// <remarks>
/// Walks can nest (a computed recomputed inside <see cref="DependencyGraph.CheckDirty" /> may read
/// another computed), so each walk takes <see cref="Top" /> as its base on entry, pushes and pops only
/// above it, and calls <see cref="Truncate" /> with that base on exit.
/// </remarks>
internal static class LinkStack
{
    private const int InitialCapacity = 16;

    private static Link?[] _items = new Link?[InitialCapacity];

    /// <summary>Number of frames in use; also the base a new walk records on entry.</summary>
    public static int Top;

    public static void Push(Link? link)
    {
        if (Top == _items.Length)
        {
            Grow();
        }

        _items[Top] = link;
        Top++;
    }

    public static Link? Pop()
    {
        Top--;

        var link = _items[Top];

        _items[Top] = null;

        return link;
    }

    /// <summary>Drops every frame above <paramref name="stackBase" /> (a walk that ended early, e.g. by an exception).</summary>
    public static void Truncate(int stackBase)
    {
        while (Top > stackBase)
        {
            Pop();
        }
    }

    private static void Grow()
    {
        var grown = new Link?[_items.Length * 2];

        for (var index = 0; index < _items.Length; index++)
        {
            grown[index] = _items[index];
        }

        _items = grown;
    }
}
