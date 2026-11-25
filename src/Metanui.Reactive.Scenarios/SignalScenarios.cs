namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for <see cref="Signal{T}" />.</summary>
public static class SignalScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario("signal reads its initial value", ReadsInitialValue),
        new Scenario("write is invisible until flush", WriteIsInvisibleUntilFlush),
        new Scenario("last write wins", LastWriteWins),
        new Scenario("flush without writes is a no-op", FlushWithoutWritesIsNoOp),
        new Scenario("custom comparer is used", CustomComparerIsUsed),
    ];

    private static void ReadsInitialValue(IExpect expect)
    {
        expect.Equal(42, Reactivity.Signal(42).Value, "initial value");
        expect.Equal(new Point(1, 2), Reactivity.Signal(new Point(1, 2)).Value, "record value");
    }

    private static void WriteIsInvisibleUntilFlush(IExpect expect)
    {
        var signal = Reactivity.Signal(0);

        signal.Value = 5;

        expect.Equal(0, signal.Value, "value before flush");
        expect.Equal(0, signal.Peek(), "peek before flush");

        Reactivity.Flush();

        expect.Equal(5, signal.Value, "value after flush");
        expect.Equal(5, signal.Peek(), "peek after flush");
    }

    private static void LastWriteWins(IExpect expect)
    {
        var signal = Reactivity.Signal(0);

        signal.Value = 1;
        signal.Value = 2;
        signal.Value = 3;
        Reactivity.Flush();

        expect.Equal(3, signal.Value, "last write");
    }

    private static void FlushWithoutWritesIsNoOp(IExpect expect)
    {
        var signal = Reactivity.Signal(7);

        Reactivity.Flush();
        Reactivity.Flush();

        expect.Equal(7, signal.Value, "value unchanged by empty flushes");
    }

    private static void CustomComparerIsUsed(IExpect expect)
    {
        var signal = Reactivity.Signal("a", new CaseInsensitiveComparer());

        signal.Value = "A";
        Reactivity.Flush();

        expect.Equal("a", signal.Value, "equal under the comparer keeps the committed value");
    }

    private sealed class CaseInsensitiveComparer : IEqualityComparer<string>
    {
        public bool Equals(string? x, string? y) => x?.ToLowerInvariant() == y?.ToLowerInvariant();

        public int GetHashCode(string value) => value.ToLowerInvariant().GetHashCode();
    }

    private sealed record Point(int X, int Y);
}
