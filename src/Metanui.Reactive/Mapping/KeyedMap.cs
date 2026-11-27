namespace Metanui.Reactive.Mapping;

/// <summary>
/// The node behind <see cref="Reactivity.Map{T, TKey, TResult}" /> (spec 4.8, Solid 2.0.4
/// <c>mapArray</c>): a computed that reconciles the source's keys with the previous run's, and a
/// list owner, created before it under the same owner, that owns one <see cref="MapOwner" /> per
/// item. The item owners are not children of the computed, so its reruns never dispose them.
/// </summary>
/// <remarks>
/// A run touches no committed state before every <c>map</c> call has succeeded (Solid's strong
/// abort): it builds the next keys, owners and results aside, commits them, then disposes the
/// owners of the removed items. A committed result list is never mutated, since observers hold it.
/// </remarks>
internal sealed class KeyedMap<T, TKey, TResult>
    where TKey : notnull
{
    /// <summary>
    /// A key with no (further) position. Looked up with <c>GetValueOrDefault</c>, not
    /// <c>TryGetValue</c>: Metano 4.0.3 lowers the <c>out</c> argument to a tuple array allocated per
    /// call, once per key of every run.
    /// </summary>
    private const int NoPosition = -1;

    private readonly Func<IReadOnlyList<T>> _source;
    private readonly Func<T, TKey> _key;
    private readonly Func<T, TResult> _map;
    private readonly IEqualityComparer<TKey> _keyComparer = EqualityComparer<TKey>.Default;
    private readonly MapOwner _listOwner;
    private readonly Computed<IReadOnlyList<TResult>> _mapped;

    /// <summary>
    /// Scratch of one run: the next new position of each key of the window, in order. Kept across
    /// runs to reuse its storage, and cleared at the end of each so it retains no key.
    /// </summary>
    private readonly Dictionary<TKey, int> _nextPositions = new();

    // Metano #840: generic array creation is not transpiled
    private List<TKey> _keys = new();

    // Metano #840: generic array creation is not transpiled
    private List<TResult> _results = new();

    private MapOwner[] _owners = [];

    /// <summary>Attaches the list owner, then the computed, to the current owner.</summary>
    internal KeyedMap(Func<IReadOnlyList<T>> source, Func<T, TKey> key, Func<T, TResult> map)
    {
        _source = source;
        _key = key;
        _map = map;
        _listOwner = new MapOwner();
        _mapped = new Computed<IReadOnlyList<TResult>>(Run, ResultComparer());
    }

    /// <summary>The accessor handed to the caller: a read of the computed, tracked in a computation.</summary>
    internal IReadOnlyList<TResult> Read() => _mapped.Value;

    /// <summary>
    /// Reads the source tracked, then reconciles untracked. When the run disposed the list owner,
    /// the item owners created after that are disposed when it ends, so none outlives it.
    /// </summary>
    private IReadOnlyList<TResult> Run()
    {
        var items = _source();
        var previousObserver = Tracking.ActiveObserver;

        Tracking.ActiveObserver = null;

        try
        {
            return Reconcile(items);
        }
        finally
        {
            Tracking.ActiveObserver = previousObserver;

            if (_listOwner.IsDisposed)
            {
                _listOwner.DisposeOwned();
            }
        }
    }

    /// <summary>
    /// Returns the previous list when every key equals the previous one at the same position.
    /// Otherwise trims the common prefix and suffix, pairs the keys of the window between them,
    /// maps the inserted items, commits, and disposes the owners of the items that left.
    /// </summary>
    private IReadOnlyList<TResult> Reconcile(IReadOnlyList<T> items)
    {
        var start = CommonPrefixLength(items);

        if (start == items.Count && start == _keys.Count)
        {
            return _results;
        }

        var keys = ReadKeys(items, start);
        var suffix = TrimmableSuffixLength(keys, start);
        var newEnd = keys.Count - suffix;
        var oldEnd = _keys.Count - suffix;
        var previousPositions = new int[newEnd - start];
        var removed = PairKeptItems(keys, start, newEnd, oldEnd, previousPositions);
        var owners = new MapOwner[keys.Count];
        var results = BuildResults(items, start, newEnd, previousPositions, owners);

        _keys = keys;
        _owners = owners;
        _results = results;
        DisposeAll(removed);

        return results;
    }

    /// <summary>Number of leading items whose key equals the previous key at the same position.</summary>
    private int CommonPrefixLength(IReadOnlyList<T> items)
    {
        var limit = Math.Min(items.Count, _keys.Count);
        var start = 0;

        while (start < limit && _keyComparer.Equals(_keys[start], _key(items[start])))
        {
            start++;
        }

        return start;
    }

    /// <summary>The next keys: the previous ones of the common prefix, then those of the rest.</summary>
    private List<TKey> ReadKeys(IReadOnlyList<T> items, int start)
    {
        // Metano #840: generic array creation is not transpiled
        var keys = new List<TKey>(items.Count);

        for (var index = 0; index < start; index++)
        {
            keys.Add(_keys[index]);
        }

        for (var index = start; index < items.Count; index++)
        {
            keys.Add(_key(items[index]));
        }

        return keys;
    }

    /// <summary>
    /// Length of the common suffix the run may leave out of the pairing. Trimming it keeps the
    /// in-order pairing of duplicates only when no key of the window between prefix and suffix
    /// occurs in it, so the suffix is trimmed only when that check, bounded to about one comparison
    /// per item, proves it.
    /// </summary>
    private int TrimmableSuffixLength(List<TKey> keys, int start)
    {
        var suffix = CommonSuffixLength(keys, start);

        if (suffix == 0)
        {
            return 0;
        }

        var newEnd = keys.Count - suffix;
        var oldEnd = _keys.Count - suffix;
        var windowLength = newEnd - start + (oldEnd - start);

        if (windowLength > keys.Count / suffix)
        {
            return 0;
        }

        var sharesAKey =
            AnyKeyOccursIn(keys, start, newEnd, keys, newEnd)
            || AnyKeyOccursIn(_keys, start, oldEnd, keys, newEnd);

        return sharesAKey ? 0 : suffix;
    }

    /// <summary>
    /// Number of trailing keys equal to the previous ones at the same distance from the end, within
    /// both lists after <paramref name="start" />.
    /// </summary>
    private int CommonSuffixLength(List<TKey> keys, int start)
    {
        var limit = Math.Min(keys.Count, _keys.Count) - start;
        var length = 0;

        while (
            length < limit
            && _keyComparer.Equals(_keys[_keys.Count - 1 - length], keys[keys.Count - 1 - length])
        )
        {
            length++;
        }

        return length;
    }

    /// <summary>
    /// Whether a key of <paramref name="source" /> between <paramref name="from" /> and
    /// <paramref name="to" /> equals a key of <paramref name="suffix" /> from
    /// <paramref name="suffixStart" /> on.
    /// </summary>
    private bool AnyKeyOccursIn(
        List<TKey> source,
        int from,
        int to,
        List<TKey> suffix,
        int suffixStart
    )
    {
        for (var index = from; index < to; index++)
        {
            for (var other = suffixStart; other < suffix.Count; other++)
            {
                if (_keyComparer.Equals(source[index], suffix[other]))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Pairs each previous item of the window (<paramref name="start" /> to
    /// <paramref name="oldEnd" />) with the next new position of its key, so the n-th occurrence of
    /// a key reuses the n-th previous one, and records its previous position (or
    /// <see cref="NoPosition" />) in <paramref name="previousPositions" />. Returns the owners of
    /// the items that left, in the previous order, or null. A window with no previous item (an
    /// insertion) pairs nothing and builds no index.
    /// </summary>
    private List<MapOwner>? PairKeptItems(
        List<TKey> keys,
        int start,
        int newEnd,
        int oldEnd,
        int[] previousPositions
    )
    {
        for (var slot = 0; slot < previousPositions.Length; slot++)
        {
            previousPositions[slot] = NoPosition;
        }

        if (oldEnd == start)
        {
            return null;
        }

        var laterPositions = IndexWindow(keys, start, newEnd);
        List<MapOwner>? removed = null;

        for (var index = start; index < oldEnd; index++)
        {
            var key = _keys[index];
            var position = _nextPositions.GetValueOrDefault(key, NoPosition);

            if (position != NoPosition)
            {
                previousPositions[position - start] = index;
                _nextPositions[key] = laterPositions[position - start];
            }
            else
            {
                removed ??= new List<MapOwner>();
                removed.Add(_owners[index]);
            }
        }

        _nextPositions.Clear();

        return removed;
    }

    /// <summary>
    /// Fills <see cref="_nextPositions" /> with the first position of each key between
    /// <paramref name="start" /> and <paramref name="end" />, and returns, per position, the next
    /// position of the same key (or <see cref="NoPosition" />): the in-order chain of duplicates.
    /// Scans backwards so each key ends on its first occurrence.
    /// </summary>
    private int[] IndexWindow(List<TKey> keys, int start, int end)
    {
        var laterPositions = new int[end - start];

        for (var index = end - 1; index >= start; index--)
        {
            var key = keys[index];

            laterPositions[index - start] = _nextPositions.GetValueOrDefault(key, NoPosition);
            _nextPositions[key] = index;
        }

        return laterPositions;
    }

    /// <summary>
    /// Builds the next results in order: the prefix, the suffix and the kept items of the window
    /// reuse their owner and result; each inserted item runs <c>map</c> under a new item owner.
    /// When <c>map</c> throws, the owners this run created are disposed and the committed state is
    /// left as it was.
    /// </summary>
    private List<TResult> BuildResults(
        IReadOnlyList<T> items,
        int start,
        int newEnd,
        int[] previousPositions,
        MapOwner[] owners
    )
    {
        // Metano #840: generic array creation is not transpiled
        var results = new List<TResult>(items.Count);
        List<MapOwner>? created = null;

        CopyKept(results, owners, 0, start, 0);

        try
        {
            for (var index = start; index < newEnd; index++)
            {
                var previous = previousPositions[index - start];

                if (previous != NoPosition)
                {
                    owners[index] = _owners[previous];
                    results.Add(_results[previous]);

                    continue;
                }

                var owner = CreateItemOwner();

                created ??= new List<MapOwner>();
                created.Add(owner);
                owners[index] = owner;
                results.Add(MapUnder(owner, items[index]));
            }
        }
        catch
        {
            DisposeAll(created);

            throw;
        }

        CopyKept(results, owners, newEnd, items.Count, _owners.Length - items.Count);

        return results;
    }

    /// <summary>
    /// Appends the kept results of the new positions <paramref name="from" /> to
    /// <paramref name="to" />, which were at the same positions plus <paramref name="shift" />.
    /// </summary>
    private void CopyKept(List<TResult> results, MapOwner[] owners, int from, int to, int shift)
    {
        for (var index = from; index < to; index++)
        {
            owners[index] = _owners[index + shift];
            results.Add(_results[index + shift]);
        }
    }

    /// <summary>Creates an item owner as the newest child of the list owner.</summary>
    private MapOwner CreateItemOwner()
    {
        var previousOwner = Tracking.CurrentOwner;

        Tracking.CurrentOwner = _listOwner;

        var owner = new MapOwner();

        Tracking.CurrentOwner = previousOwner;

        return owner;
    }

    /// <summary>
    /// Runs <c>map</c> with <paramref name="owner" /> as the current owner (the run is already
    /// untracked). When the call disposed the item owner (through an ancestor's disposer), what it
    /// created afterwards is disposed now, as at the end of a root body that disposed its root.
    /// </summary>
    private TResult MapUnder(MapOwner owner, T item)
    {
        var previousOwner = Tracking.CurrentOwner;

        Tracking.CurrentOwner = owner;

        try
        {
            return _map(item);
        }
        finally
        {
            Tracking.CurrentOwner = previousOwner;

            if (owner.IsDisposed)
            {
                owner.DisposeOwned();
            }
        }
    }

    /// <summary>
    /// The comparer of the result lists, typed as the interface. Metano drops the type arguments of
    /// <c>new Computed&lt;T&gt;(...)</c>, so TS infers <c>T</c> from the argument types, and the
    /// nullable parameters of <see cref="ListIdentityComparer{TResult}" /> would make it
    /// <c>IReadOnlyList | null</c> (Metano issue pending).
    /// </summary>
    private static IEqualityComparer<IReadOnlyList<TResult>> ResultComparer() =>
        new ListIdentityComparer<TResult>();

    private static void DisposeAll(List<MapOwner>? owners)
    {
        if (owners is null)
        {
            return;
        }

        foreach (var owner in owners)
        {
            owner.Dispose();
        }
    }
}
