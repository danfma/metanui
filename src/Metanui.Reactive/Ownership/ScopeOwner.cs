namespace Metanui.Reactive.Ownership;

/// <summary>
/// A pure grouping owner: neither a computation nor a root, it never runs and only holds the
/// computations, roots and cleanups created under it until it is disposed. A keyed map uses one as
/// its list owner and one per item (spec 4.8). Not being a root, it rejects signal writes while it
/// is the current owner.
/// </summary>
internal sealed class ScopeOwner : OwnerNode
{
    /// <summary>
    /// A scope owner is the current owner only inside a computation's run (the map run that maps
    /// an item), and so is everything under it that runs: a computation, which catches by itself, or
    /// a root body created during such a run. An error thrown or a cleanup error raised there would
    /// reach that computation, so it counts as caught (spec 4.5): a cleanup error waits for the end
    /// of the flush or the next root disposal instead of being rethrown into the run.
    /// </summary>
    internal override bool CatchesErrors => true;

    /// <summary>An owner subscribes to nothing, so no dependency walk ever asks it to update.</summary>
    internal override bool Update() =>
        throw new InvalidOperationException("A scope owner cannot be updated.");

    /// <summary>An owner subscribes to nothing, so propagation never reaches it.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A scope owner cannot be notified.");
}
