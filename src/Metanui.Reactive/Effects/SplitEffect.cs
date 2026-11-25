using Metano.Annotations;

namespace Metanui.Reactive.Effects;

/// <summary>Effect whose compute produces a <typeparamref name="T" /> handed to its apply.</summary>
[Transpile]
internal sealed class SplitEffect<T>(Func<T> compute, Action<T, T?> apply) : EffectNode
{
    private readonly Func<T> _compute = compute;
    private readonly Action<T, T?> _apply = apply;
    private T _value = default!;
    private T? _applied;
    private bool _hasApplied;

    protected override void Compute() => _value = _compute();

    protected override void Apply()
    {
        var previous = _hasApplied ? _applied : _value;

        _applied = _value;
        _hasApplied = true;
        _apply(_value, previous);
    }
}
