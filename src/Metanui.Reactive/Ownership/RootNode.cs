namespace Metanui.Reactive.Ownership;

/// <summary>
/// An owner that is not a computation: it has no dependencies and never re-runs, so writing a signal
/// while it is the current owner is allowed, unless the root sits under a computation. Backs
/// <see cref="Reactivity.Root{T}" />, and <see cref="Reactivity.ErrorBoundary" /> when it carries an
/// error handler.
/// </summary>
internal sealed class RootNode : OwnerNode
{
    /// <summary>
    /// Whether a computation is among the root's owners, so a write in its body is still a write
    /// inside that computation. Fixed at creation: a root's owner chain never changes.
    /// </summary>
    internal readonly bool UnderComputation;

    /// <summary>The error boundary's handler; null for a plain root.</summary>
    private readonly Action<Exception>? _errorHandler;

    /// <summary>
    /// Nesting depth of running error handlers. A handler runs with no owner, yet an exception it
    /// throws goes to the next boundary up, so a disposer called there defers its cleanup error.
    /// </summary>
    private static int _handlerDepth;

    internal RootNode(Action<Exception>? errorHandler = null)
    {
        UnderComputation = IsUnderComputation(Parent);
        _errorHandler = errorHandler;
    }

    /// <summary>
    /// Runs <paramref name="body" /> with this root as the current owner and no observer (a root body
    /// is untracked), handing it the disposer.
    /// </summary>
    internal T Run<T>(Func<Action, T> body)
    {
        var previousOwner = Tracking.CurrentOwner;
        var previousObserver = Tracking.ActiveObserver;

        Tracking.CurrentOwner = this;
        Tracking.ActiveObserver = null;

        try
        {
            return body(DisposeFromCaller);
        }
        finally
        {
            EndRun(previousOwner, previousObserver);
        }
    }

    /// <summary>
    /// Runs an error boundary's body like a root body; an exception it throws goes to the boundary's
    /// own handler once the run has ended, so what a body that disposed its boundary created
    /// afterwards is already disposed when the handler runs.
    /// </summary>
    internal void RunBoundary(Action body)
    {
        var failure = RunBoundaryBody(body);

        if (failure is not null)
        {
            HandleError(failure);
        }
    }

    /// <summary>Runs the boundary body and returns the exception it threw, or null.</summary>
    private Exception? RunBoundaryBody(Action body)
    {
        var previousOwner = Tracking.CurrentOwner;
        var previousObserver = Tracking.ActiveObserver;

        Tracking.CurrentOwner = this;
        Tracking.ActiveObserver = null;

        try
        {
            body();

            return null;
        }
        catch (Exception error)
        {
            return error;
        }
        finally
        {
            EndRun(previousOwner, previousObserver);
        }
    }

    /// <summary>
    /// Restores the tracking state of the caller. When the body disposed this root (through its
    /// disposer, or an owner's), what it created or registered after the disposal is disposed now,
    /// as a computation does at the end of a run that disposed it (<see cref="OwnerNode.PurgeStaleDeps" />):
    /// a disposed root is never disposed again, so nothing else would.
    /// </summary>
    private void EndRun(OwnerNode? previousOwner, ReactiveNode? previousObserver)
    {
        Tracking.CurrentOwner = previousOwner;
        Tracking.ActiveObserver = previousObserver;

        if (IsDisposed)
        {
            DisposeOwned();
        }
    }

    /// <summary>A root has no dependencies, so no dependency walk ever asks it to update.</summary>
    internal override bool Update() =>
        throw new InvalidOperationException("A root cannot be updated.");

    /// <summary>A root subscribes to nothing, so propagation never reaches it.</summary>
    internal override void Notify() =>
        throw new InvalidOperationException("A root cannot be notified.");

    /// <summary>
    /// The disposer handed to the body. It rethrows the first cleanup error of the disposal at once
    /// only when nothing on the way out would take it: outside a flush and any error handler, and with
    /// no computation or error boundary among the current owners (a computed would cache it, an effect
    /// compute, a boundary body or a handler would hand it to a boundary). Otherwise the error waits
    /// for the end of the running flush, or for the next flush or root disposal (Solid
    /// <c>disposeRootSelf</c>; spec 4.5: cleanup errors never go to an error handler).
    /// </summary>
    private void DisposeFromCaller()
    {
        Dispose();

        if (!FlushLoop.IsRunning && _handlerDepth == 0 && !IsCaughtByOwner(Tracking.CurrentOwner))
        {
            Teardown.RethrowFirstError();
        }
    }

    /// <summary>
    /// Runs the handler untracked, with no owner and outside any apply, so it may write signals. An
    /// exception thrown by the handler goes to the next boundary up, or escapes.
    /// </summary>
    private void HandleError(Exception error)
    {
        var previousOwner = Tracking.CurrentOwner;
        var previousObserver = Tracking.ActiveObserver;
        var previousApply = Tracking.ActiveApply;

        Tracking.CurrentOwner = null;
        Tracking.ActiveObserver = null;
        Tracking.ActiveApply = null;
        _handlerDepth++;

        try
        {
            _errorHandler!(error);
        }
        catch (Exception handlerError)
        {
            if (!TryRouteError(Parent, handlerError))
            {
                throw;
            }
        }
        finally
        {
            _handlerDepth--;
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveObserver = previousObserver;
            Tracking.ActiveApply = previousApply;
        }
    }

    /// <summary>
    /// Hands <paramref name="error" /> to the nearest error boundary from <paramref name="owner" />
    /// (the owner of the node that threw, read before that node ran) up through its owners (spec 4.4).
    /// Returns false when there is none, so the caller rethrows.
    /// </summary>
    /// <remarks>
    /// When the failing run disposed an owner between the node and the boundary, that owner is
    /// detached and the walk stops there, so the error escapes instead.
    /// </remarks>
    internal static bool TryRouteError(OwnerNode? owner, Exception error)
    {
        while (owner is not null)
        {
            if (owner is RootNode root && root._errorHandler is not null)
            {
                root.HandleError(error);

                return true;
            }

            owner = owner.Parent;
        }

        return false;
    }

    /// <summary>
    /// Whether an exception thrown now under <paramref name="owner" /> would be caught before it
    /// reaches the caller: by a computation or by an error boundary among the owners.
    /// </summary>
    private static bool IsCaughtByOwner(OwnerNode? owner)
    {
        while (owner is not null)
        {
            if (owner is not RootNode root || root._errorHandler is not null)
            {
                return true;
            }

            owner = owner.Parent;
        }

        return false;
    }

    private static bool IsUnderComputation(OwnerNode? parent) =>
        parent is not null && (parent is not RootNode root || root.UnderComputation);
}
