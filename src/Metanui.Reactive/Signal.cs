namespace Metanui.Reactive;

/// <summary>
/// A reactive value cell. Writes are queued and only become visible when the flush commits them.
/// </summary>
public sealed class Signal<T> : SignalNode
{
    private readonly IEqualityComparer<T> _comparer;
    private T _value;
    private T _pending;
    private bool _hasPending;

    public Signal(T initialValue, IEqualityComparer<T>? comparer = null)
    {
        _comparer = comparer ?? EqualityComparer<T>.Default;
        _value = initialValue;
        _pending = initialValue;
        Flags = ReactiveFlags.Mutable;
    }

    public T Value
    {
        get => _value;
        set
        {
            _pending = value;

            if (_hasPending)
            {
                return;
            }

            _hasPending = true;
            Queue();
        }
    }

    // Metano: the import of a type referenced only inside a property setter body is not emitted
    private void Queue() => FlushLoop.Enqueue(this);

    /// <summary>Reads the committed value without subscribing the current observer.</summary>
    public T Peek() => _value;

    /// <summary>Commits the pending value, if any, and reports whether the committed value changed.</summary>
    internal override bool Update()
    {
        if (!_hasPending)
        {
            return false;
        }

        _hasPending = false;

        if (_comparer.Equals(_value, _pending))
        {
            return false;
        }

        _value = _pending;

        return true;
    }

    internal override void CommitPending() => Update();
}
