using Metanui.Reactive;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>A reader produced by <c>Bind(...)</c>: assigning it to a <see cref="Bindable{T}" /> property binds it.</summary>
public sealed class Binding<T>(Func<T> read)
{
    public Func<T> Read => read;
}

/// <summary>
/// The type of a bindable element property (option G): a static value or a reader. A string converts
/// implicitly (static write), a <see cref="Binding{T}" /> converts implicitly (one effect), and
/// <c>property &lt;&lt;= () =&gt; ...</c> goes through the static <c>&lt;&lt;</c> operator plus the setter,
/// because C# never applies an instance <c>&lt;&lt;=</c> operator to a property receiver.
/// </summary>
public sealed class Bindable<T>
{
    private Bindable(T value, Func<T>? read)
    {
        Value = value;
        Read = read;
    }

    public T Value { get; }

    public Func<T>? Read { get; }

    public static implicit operator Bindable<T>(T value) => new(value, null);

    public static implicit operator Bindable<T>(Binding<T> binding) => new(default!, binding.Read);

    public static Bindable<T> operator <<(Bindable<T> current, Func<T> read) => new(default!, read);

    /// <summary>The current value; inside a tracked read it subscribes to the reader.</summary>
    public T Get() => Read is null ? Value : Read();

    /// <summary>Writes the value once, or binds the reader with one effect.</summary>
    public void ApplyTo(Action<T> write)
    {
        if (Read is null)
        {
            write(Value);

            return;
        }

        Reactivity.Effect(Read, (value, previous) => write(value));
    }
}
