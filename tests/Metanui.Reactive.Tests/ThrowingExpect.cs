using Metanui.Reactive.Scenarios;

namespace Metanui.Reactive.Tests;

/// <summary>TUnit adapter for <see cref="IExpect" />: a failed expectation throws.</summary>
internal sealed class ThrowingExpect : IExpect
{
    public void Equal<T>(T expected, T actual, string label)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException($"{label}: expected {expected}, got {actual}");
        }
    }

    public void IsTrue(bool condition, string label)
    {
        if (!condition)
        {
            throw new InvalidOperationException($"{label}: expected true, got false");
        }
    }
}
