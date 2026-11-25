namespace Metanui.Reactive;

/// <summary>A reactive value cell. Phase 1 only reads its initial value.</summary>
public sealed class Signal<T>(T initialValue)
{
    private readonly T _value = initialValue;

    public T Value => _value;
}
