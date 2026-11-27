namespace Metanui.Ui;

/// <summary>
/// A component prop: a static value or a reader. Assign a value directly (implicit conversion from
/// <typeparamref name="T" />) or a reader through <see cref="View.Live{T}" />; <see cref="Value" />
/// calls the reader on every read, so a read inside a binding in <see cref="Component{TSelf}.Render" />
/// is tracked and follows the reader's sources.
/// </summary>
/// <remarks>
/// It holds no signal, so assigning it writes nothing reactive: it works in a factory lambda that
/// runs inside a <c>For</c> item or a <c>Show</c> branch, and a static value reaches
/// <see cref="Component{TSelf}.Render" /> at once, with no flush. A <c>struct</c> (no allocation on
/// .NET) and not a <c>record</c> (no record members). <c>default</c> reads as <c>default(T)</c> on
/// .NET. In TypeScript a written <c>default</c>, or an uninitialized <see cref="Prop{T}" /> property,
/// is refused (MS0001, Metano #851); the emitted <c>$default()</c> reads <c>null</c>.
/// </remarks>
public readonly struct Prop<T>
{
    private readonly T _value;
    private readonly Func<T>? _read;

    private Prop(T value, Func<T>? read)
    {
        _value = value;
        _read = read;
    }

    /// <summary>The static value, or the reader's current result.</summary>
    public T Value => _read is null ? _value : _read();

    public static implicit operator Prop<T>(T value) => new(value, null);

    internal static Prop<T> Reading(Func<T> read) => new(default!, read);
}
