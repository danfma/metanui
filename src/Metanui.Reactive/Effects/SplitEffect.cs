namespace Metanui.Reactive.Effects;

/// <summary>
/// Effect whose compute produces a <typeparamref name="T" /> handed to its apply. Disposal releases
/// both callbacks and both values; a disposed effect never runs either again.
/// </summary>
internal sealed class SplitEffect<T>(Func<T> compute, Action<T, T> apply) : EffectNode
{
    private Func<T>? _compute = compute;
    private Action<T, T>? _apply = apply;
    private T _value = default!;
    private T _applied = default!;
    private bool _hasApplied;

    /// <summary>A compute that disposed its own effect keeps no value: the disposal already released it.</summary>
    protected override void Compute()
    {
        var value = _compute!();

        if (!IsDisposed)
        {
            _value = value;
        }
    }

    protected override void Apply()
    {
        var previous = _hasApplied ? _applied : _value;

        _applied = _value;
        _hasApplied = true;
        _apply!(_value, previous);
    }

    protected override void ReleaseUserState()
    {
        _compute = null;
        _apply = null;
        _value = default!;
        _applied = default!;
    }
}
