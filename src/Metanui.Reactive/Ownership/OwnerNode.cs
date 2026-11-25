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
    /// Ends a run: unlinks the dependencies it did not read again, or all of them when the run
    /// disposed the node itself, so a disposed node keeps no dependency.
    /// </summary>
    internal void PurgeStaleDeps()
    {
        if (IsDisposed)
        {
            DepsTail = null;
        }

        DependencyGraph.PurgeDeps(this);
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
