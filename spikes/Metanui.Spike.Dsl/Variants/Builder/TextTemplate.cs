using System.Runtime.CompilerServices;
using Metanui.Reactive;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>
/// Interpolated string handler for <c>Bind($"Count: {count}")</c>: a hole that receives a signal stays
/// a live read, any other hole is formatted once. A hole such as <c>{count.Value}</c> reaches the
/// handler as a plain value, already read, so it can never be reactive.
/// </summary>
[InterpolatedStringHandler]
public sealed class TextTemplate
{
    private readonly List<Func<string>> _parts = [];

    public TextTemplate(int literalLength, int formattedCount) { }

    public void AppendLiteral(string literal) => _parts.Add(() => literal);

    public void AppendFormatted<T>(Signal<T> signal) => _parts.Add(() => $"{signal.Value}");

    public void AppendFormatted<T>(T value)
    {
        var text = $"{value}";

        _parts.Add(() => text);
    }

    public string Render()
    {
        var text = "";

        foreach (var part in _parts)
        {
            text += part();
        }

        return text;
    }
}
