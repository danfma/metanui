namespace Metanui.Reactive.Mapping;

/// <summary>
/// An owner that is neither a computation nor a root: it never runs and only holds what is created
/// under it until it is disposed. A <see cref="KeyedMap{T, TKey, TResult}" /> uses one as its list
/// owner and one per item (spec 4.8). Not being a root, it rejects signal writes while it is the
/// current owner, as the <c>map</c> callback runs inside the map's computation.
/// </summary>
internal sealed class MapOwner : OwnerNode
{
    /// <summary>A plain owner lets an exception through, as a plain root does.</summary>
    internal override bool CatchesErrors => false;

    /// <summary>An owner subscribes to nothing, so no dependency walk ever asks it to update.</summary>
    internal override bool Update() =>
        throw new InvalidOperationException("A map owner cannot be updated.");

    /// <summary>An owner subscribes to nothing, so propagation never reaches it.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A map owner cannot be notified.");
}
