using Metano.Annotations;

namespace Metanui.Reactive.Ownership;

/// <summary>
/// An owner that is not a computation: it has no dependencies and never re-runs, so writing a signal
/// while it is the current owner is allowed, unless the root sits under a computation. Backs
/// <see cref="Reactivity.Root{T}" />, and <see cref="Reactivity.ErrorBoundary" /> when it carries an
/// error handler.
/// </summary>
[Transpile]
internal sealed class RootNode : OwnerNode
{
    /// <summary>
    /// Whether a computation is among the root's owners, so a write in its body is still a write
    /// inside that computation. Fixed at creation: a root's owner chain never changes.
    /// </summary>
    internal readonly bool UnderComputation;

    /// <summary>The error boundary's handler; null for a plain root.</summary>
    private readonly Action<Exception>? _errorHandler;

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
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveObserver = previousObserver;
        }
    }

    /// <summary>
    /// Runs an error boundary's body like a root body; an exception it throws goes to the boundary's
    /// own handler.
    /// </summary>
    internal void RunBoundary(Action body)
    {
        var previousOwner = Tracking.CurrentOwner;
        var previousObserver = Tracking.ActiveObserver;

        Tracking.CurrentOwner = this;
        Tracking.ActiveObserver = null;

        try
        {
            body();
        }
        catch (Exception error)
        {
            HandleError(error);
        }
        finally
        {
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveObserver = previousObserver;
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
    /// only when nothing on the way out would take it: outside a flush, and with no computation or
    /// error boundary among the current owners (a computed would cache it, an effect compute or a
    /// boundary body would hand it to a boundary). Otherwise the error waits for the end of the
    /// running flush, or for the next flush or root disposal (Solid <c>disposeRootSelf</c>; spec 4.5:
    /// cleanup errors never go to an error handler).
    /// </summary>
    private void DisposeFromCaller()
    {
        Dispose();

        if (!FlushLoop.IsRunning && !IsCaughtByOwner(Tracking.CurrentOwner))
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

        try
        {
            _errorHandler!(error);
        }
        catch (Exception handlerError)
        {
            if (!TryRouteError(this, handlerError))
            {
                throw;
            }
        }
        finally
        {
            Tracking.CurrentOwner = previousOwner;
            Tracking.ActiveObserver = previousObserver;
            Tracking.ActiveApply = previousApply;
        }
    }

    /// <summary>
    /// Hands <paramref name="error" />, thrown by <paramref name="node" />, to the nearest error
    /// boundary among its owners (spec 4.4). Returns false when there is none, so the caller rethrows.
    /// </summary>
    internal static bool TryRouteError(OwnerNode node, Exception error)
    {
        var owner = node.Parent;

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
