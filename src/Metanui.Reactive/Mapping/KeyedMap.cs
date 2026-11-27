namespace Metanui.Reactive.Mapping;

/// <summary>
/// The node behind <see cref="Reactivity.Map{T, TKey, TResult}" /> (spec 4.8, Solid 2.0.4
/// <c>mapArray</c>): a computed that reconciles the source's keys with the previous run's, and a
/// list owner, created before it under the same owner, that owns one <see cref="ScopeOwner" /> per
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
    /// <summary>A key with no (further) position, as <c>GetValueOrDefault</c> returns it.</summary>
    // Metano (reported 2026-11-27, issue number pending): an `out` argument lowers to a tuple
    // array allocated per call, so lookups use `GetValueOrDefault`, not `TryGetValue`.
    private const int NoPosition = -1;

    private readonly Func<IReadOnlyList<T>> _source;
    private readonly Func<T, TKey> _key;
    private readonly Func<T, TResult> _map;
    private readonly ScopeOwner _listOwner;
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

    private ScopeOwner[] _owners = [];

    /// <summary>
    /// Scratch of one run, per window slot: the previous position of the item paired with it, or
    /// <see cref="NoPosition" />. Grow-only and reused, as concrete <c>int</c> arrays.
    /// </summary>
    private int[] _previousPositions = [];

    /// <summary>Scratch of one run, per window slot: the next slot of the same key, or <see cref="NoPosition" />.</summary>
    private int[] _laterPositions = [];

    /// <summary>Attaches the list owner, then the computed, to the current owner.</summary>
    internal KeyedMap(Func<IReadOnlyList<T>> source, Func<T, TKey> key, Func<T, TResult> map)
    {
        _source = source;
        _key = key;
        _map = map;
        _listOwner = new ScopeOwner();
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

        EnsureScratch(newEnd - start);

        var removed = PairKeptItems(keys, start, newEnd, oldEnd);
        var owners = new ScopeOwner[keys.Count];
        var results = BuildResults(items, start, newEnd, owners);

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

        while (start < limit && KeysEqual(_keys[start], _key(items[start])))
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
            && KeysEqual(_keys[_keys.Count - 1 - length], keys[keys.Count - 1 - length])
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
                if (KeysEqual(source[index], suffix[other]))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>Grows the per-slot scratch arrays to hold at least <paramref name="length" /> slots.</summary>
    private void EnsureScratch(int length)
    {
        if (_previousPositions.Length >= length)
        {
            return;
        }

        var capacity = Math.Max(length, _previousPositions.Length * 2);

        _previousPositions = new int[capacity];
        _laterPositions = new int[capacity];
    }

    /// <summary>
    /// Pairs each previous item of the window (<paramref name="start" /> to
    /// <paramref name="oldEnd" />) with the next new position of its key, so the n-th occurrence of
    /// a key reuses the n-th previous one, and records its previous position (or
    /// <see cref="NoPosition" />) in <see cref="_previousPositions" />. Returns the owners of the
    /// items that left, in the previous order, or null. A window with no previous item (an
    /// insertion) pairs nothing and builds no index. The index is cleared even when a key's
    /// <c>Equals</c> or <c>GetHashCode</c> throws, so an aborted run leaves no stale entry.
    /// </summary>
    private List<ScopeOwner>? PairKeptItems(List<TKey> keys, int start, int newEnd, int oldEnd)
    {
        for (var slot = 0; slot < newEnd - start; slot++)
        {
            _previousPositions[slot] = NoPosition;
        }

        if (oldEnd == start)
        {
            return null;
        }

        try
        {
            IndexWindow(keys, start, newEnd);

            return PairWithIndex(start, oldEnd);
        }
        finally
        {
            _nextPositions.Clear();
        }
    }

    /// <summary>
    /// Fills <see cref="_nextPositions" /> with the first position of each key between
    /// <paramref name="start" /> and <paramref name="end" />, and <see cref="_laterPositions" />
    /// with, per slot, the next position of the same key (or <see cref="NoPosition" />): the
    /// in-order chain of duplicates. Scans backwards so each key ends on its first occurrence.
    /// </summary>
    private void IndexWindow(List<TKey> keys, int start, int end)
    {
        for (var index = end - 1; index >= start; index--)
        {
            var key = keys[index];

            _laterPositions[index - start] = _nextPositions.GetValueOrDefault(key, NoPosition);
            _nextPositions[key] = index;
        }
    }

    /// <summary>
    /// Looks up each previous key of the window in the index, takes its next new position, and
    /// collects the owners of the keys that left.
    /// </summary>
    private List<ScopeOwner>? PairWithIndex(int start, int oldEnd)
    {
        List<ScopeOwner>? removed = null;

        for (var index = start; index < oldEnd; index++)
        {
            var key = _keys[index];
            var position = _nextPositions.GetValueOrDefault(key, NoPosition);

            if (position != NoPosition)
            {
                _previousPositions[position - start] = index;
                _nextPositions[key] = _laterPositions[position - start];
            }
            else
            {
                removed ??= new List<ScopeOwner>();
                removed.Add(_owners[index]);
            }
        }

        return removed;
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
        ScopeOwner[] owners
    )
    {
        // Metano #840: generic array creation is not transpiled
        var results = new List<TResult>(items.Count);
        List<ScopeOwner>? created = null;

        CopyKept(results, owners, 0, start, 0);

        try
        {
            for (var index = start; index < newEnd; index++)
            {
                var previous = _previousPositions[index - start];

                if (previous != NoPosition)
                {
                    owners[index] = _owners[previous];
                    results.Add(_results[previous]);

                    continue;
                }

                var owner = CreateItemOwner();

                created ??= new List<ScopeOwner>();
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
    private void CopyKept(List<TResult> results, ScopeOwner[] owners, int from, int to, int shift)
    {
        for (var index = from; index < to; index++)
        {
            owners[index] = _owners[index + shift];
            results.Add(_results[index + shift]);
        }
    }

    /// <summary>Creates an item owner as the newest child of the list owner.</summary>
    private ScopeOwner CreateItemOwner()
    {
        var previousOwner = Tracking.CurrentOwner;

        Tracking.CurrentOwner = _listOwner;

        var owner = new ScopeOwner();

        Tracking.CurrentOwner = previousOwner;

        return owner;
    }

    /// <summary>
    /// Runs <c>map</c> with <paramref name="owner" /> as the current owner (the run is already
    /// untracked). When the call disposed the item owner (through an ancestor's disposer), what it
    /// created afterwards is disposed now, as at the end of a root body that disposed its root.
    /// </summary>
    private TResult MapUnder(ScopeOwner owner, T item)
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
    /// The comparer of the result lists, typed as the interface, so TS infers the computed's type
    /// from it.
    /// </summary>
    // Metano (reported 2026-11-27, issue number pending): `new Computed<T>(...)` drops its type
    // arguments, so TS would infer `T` from the comparer's nullable parameters.
    private static IEqualityComparer<IReadOnlyList<TResult>> ResultComparer() =>
        new ListIdentityComparer<TResult>();

    /// <summary>
    /// Key equality as <see cref="EqualityComparer{T}.Default" /> defines it, called directly so
    /// .NET devirtualizes it and TS emits a plain function call, with no interface dispatch per key.
    /// </summary>
    private static bool KeysEqual(TKey left, TKey right) =>
        EqualityComparer<TKey>.Default.Equals(left, right);

    private static void DisposeAll(List<ScopeOwner>? owners)
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
