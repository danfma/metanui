namespace Metanui.Reactive.Ownership;

/// <summary>
/// A node of the ownership tree (spec 5.2): it owns the computations created while it runs and the
/// cleanups registered meanwhile, and disposes them when it re-runs or is disposed. The tree is
/// separate from the dependency links, so those stay as lean as in alien-signals. Public only so
/// the public primitives can derive from it.
/// </summary>
/// <remarks>
/// Follows <c>@solidjs/signals</c> 2.0.4 (<c>linkChild</c>, <c>disposeChildren</c>,
/// <c>runDisposal</c>): a child is prepended to its parent, so the newest child is disposed first;
/// children are disposed before the owner's own cleanups, which run last registered first.
/// </remarks>
public abstract class OwnerNode : ReactiveNode
{
    private const string CreationInsideApplyMessage =
        "Cannot create a computed, effect or root inside an effect's apply: the apply has no owner, so "
        + "nothing would ever dispose it. Create it in the compute instead.";

    internal OwnerNode? Parent;
    internal OwnerNode? FirstChild;
    internal OwnerNode? NextSibling;
    internal OwnerNode? PrevSibling;
    internal CleanupEntry? Cleanups;
    internal bool IsDisposed;

    /// <summary>Next node whose dependency links wait for the end of a dirty check (see <see cref="UnlinkDependenciesOnDisposal" />).</summary>
    internal OwnerNode? NextDeferredUnlink;

    /// <summary>Disposed nodes whose dependency links wait for the end of the running dirty check.</summary>
    private static OwnerNode? _deferredUnlinks;

    /// <summary>
    /// Creates the node as the newest child of the current owner, if any. Creating it directly in an
    /// effect's apply, which has no owner, throws: nothing would ever dispose it (Solid 2.0.4
    /// <c>PRIMITIVE_IN_EFFECT_CALLBACK</c>).
    /// </summary>
    internal OwnerNode()
    {
        var parent = Tracking.CurrentOwner;

        if (parent is not null)
        {
            AttachTo(parent);
        }
        else if (Tracking.ActiveApply is not null)
        {
            throw new InvalidOperationException(CreationInsideApplyMessage);
        }
    }

    /// <summary>
    /// Whether an exception thrown while this node is the current owner is caught here: a computation
    /// caches it (computed) or hands it to a boundary (effect compute); a root lets it through unless
    /// it is an error boundary.
    /// </summary>
    internal virtual bool CatchesErrors => true;

    /// <summary>
    /// Rethrows the first cleanup error kept by a disposal, unless something on the way out would
    /// catch it: an error handler that is running, or a computation or error boundary among the current
    /// owners. Such an error stays kept for the end of the running flush, or the next flush or root
    /// disposal (spec 4.5: cleanup errors never go to an error handler).
    /// </summary>
    internal static void RethrowCleanupErrorUnlessCaught()
    {
        if (Tracking.ErrorHandlerDepth == 0 && !IsCaughtByOwner(Tracking.CurrentOwner))
        {
            Teardown.RethrowFirstError();
        }
    }

    /// <summary>Registers <paramref name="cleanup" />; cleanups run last registered first.</summary>
    internal void AddCleanup(Action cleanup) => Cleanups = new CleanupEntry(cleanup, Cleanups);

    /// <summary>
    /// Disposes the node for good: detaches it from its parent, disposes what it owns, then releases
    /// what the node type holds (<see cref="OnDisposed" />). Disposing twice does nothing.
    /// </summary>
    internal void Dispose()
    {
        if (IsDisposed)
        {
            return;
        }

        IsDisposed = true;
        Detach();
        DisposeOwned();
        OnDisposed();
    }

    /// <summary>
    /// Disposes every child, newest first and depth-first, then runs the cleanups. Used before a
    /// re-run and on disposal. Both lists are taken off the node first, so a cleanup that disposes
    /// an ancestor, or creates a new child, never makes the walk run an entry twice. A throwing
    /// cleanup does not stop the walk (<see cref="Teardown" />). Every disposed child leaves with its
    /// sibling pointers cleared, so holding one does not retain the rest of the chain.
    /// </summary>
    internal void DisposeOwned()
    {
        var child = FirstChild;

        FirstChild = null;

        while (child is not null)
        {
            child.Parent = null;
            child.PrevSibling = null;
            child.Dispose();

            // Read after disposing: a cleanup that disposed a later sibling spliced it out of the
            // chain, so the next pointer already skips it.
            var next = child.NextSibling;

            child.NextSibling = null;
            child = next;
        }

        var cleanups = Cleanups;

        Cleanups = null;
        Teardown.Run(cleanups);
    }

    /// <summary>Releases what the node type holds once its children and cleanups are gone.</summary>
    internal virtual void OnDisposed() { }

    /// <summary>
    /// Unlinks every dependency of a node being disposed, whose dependency tail the caller already
    /// cleared. While a dirty check runs, the links wait until the outermost check ends.
    /// </summary>
    /// <remarks>
    /// Metanui: alien-signals never disposes a node during <c>checkDirty</c>; here a cleanup or a run
    /// the update triggers may (spec 4.5). The walk may be standing on the disposed node's links
    /// (it is the observer being checked, or one on the way to it): unlinking them now would make it
    /// follow removed links, or update a computed that the disposal just unwatched. Deferring the
    /// unlink keeps the graph the walk sees intact; the disposed node only changes its flags, which
    /// the walk already honours (an effect ends with none, and a computed reports no change).
    /// </remarks>
    internal void UnlinkDependenciesOnDisposal()
    {
        if (Tracking.DirtyCheckDepth == 0)
        {
            DependencyGraph.PurgeDeps(this);

            return;
        }

        NextDeferredUnlink = _deferredUnlinks;
        _deferredUnlinks = this;
    }

    /// <summary>
    /// Runs the dirty check of this pending node (alien-signals <c>checkDirty</c>), counted once per
    /// check, then, when it was the outermost one, unlinks the nodes disposed meanwhile, even when the
    /// check ends with an exception.
    /// </summary>
    internal bool IsAnyDependencyDirty()
    {
        Tracking.DirtyCheckDepth++;

        try
        {
            return DependencyGraph.CheckDirty(Deps!, this);
        }
        finally
        {
            Tracking.DirtyCheckDepth--;

            if (Tracking.DirtyCheckDepth == 0 && _deferredUnlinks is not null)
            {
                UnlinkDeferredDependencies();
            }
        }
    }

    /// <summary>
    /// Ends a run: unlinks the dependencies it did not read again. When the run disposed the node
    /// itself, it unlinks all of them and disposes what the run created or registered after the
    /// disposal, so a disposed node keeps no dependency, child or cleanup. Its flags go back to what
    /// disposal left, as for a deferred unlink: the dependencies the run read after the disposal
    /// linked it again, and a flush nested in the run may have marked it pending or dirty through
    /// them.
    /// </summary>
    internal void PurgeStaleDeps()
    {
        if (IsDisposed)
        {
            DepsTail = null;
            Flags &= ReactiveFlags.Mutable | ReactiveFlags.Errored;
            DisposeOwned();
        }

        DependencyGraph.PurgeDeps(this);
    }

    /// <summary>
    /// Unlinks the dependencies of every node a finished dirty check disposed. Each node leaves the
    /// list before its unlink, which may run cleanups that dispose and defer more nodes. A flush nested
    /// in the check may have marked a node pending through the links it still had; its flags go back
    /// to what disposal left (a computed keeps <see cref="ReactiveFlags.Mutable" /> and its error, an
    /// effect has none), so a later read of the disposed computed returns its last value instead of
    /// checking dependencies it no longer has.
    /// </summary>
    private static void UnlinkDeferredDependencies()
    {
        while (_deferredUnlinks is not null)
        {
            var node = _deferredUnlinks;

            _deferredUnlinks = node.NextDeferredUnlink;
            node.NextDeferredUnlink = null;
            node.DepsTail = null;
            node.Flags &= ReactiveFlags.Mutable | ReactiveFlags.Errored;
            DependencyGraph.PurgeDeps(node);
        }
    }

    /// <summary>
    /// Whether an exception thrown now under <paramref name="owner" /> would be caught before it
    /// reaches the caller: by a computation or by an error boundary among the owners.
    /// </summary>
    private static bool IsCaughtByOwner(OwnerNode? owner)
    {
        while (owner is not null)
        {
            if (owner.CatchesErrors)
            {
                return true;
            }

            owner = owner.Parent;
        }

        return false;
    }

    private void AttachTo(OwnerNode parent)
    {
        var head = parent.FirstChild;

        Parent = parent;
        NextSibling = head;

        if (head is not null)
        {
            head.PrevSibling = this;
        }

        parent.FirstChild = this;
    }

    /// <summary>Splices the node out of its parent's children and clears its sibling pointers.</summary>
    private void Detach()
    {
        var parent = Parent;

        if (parent is null)
        {
            return;
        }

        var previous = PrevSibling;
        var next = NextSibling;

        Parent = null;
        PrevSibling = null;
        NextSibling = null;

        if (previous is null)
        {
            parent.FirstChild = next;
        }
        else
        {
            previous.NextSibling = next;
        }

        if (next is not null)
        {
            next.PrevSibling = previous;
        }
    }
}
