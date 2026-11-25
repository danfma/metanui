namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for <see cref="Signal{T}" />.</summary>
public static class SignalScenarios
{
    public static Scenario[] All { get; } =
    [new Scenario("signal reads its initial value", ReadsInitialValue)];

    private static void ReadsInitialValue(IExpect expect)
    {
        expect.Equal(42, new Signal<int>(42).Value, "initial value");
        expect.Equal(new Point(1, 2), new Signal<Point>(new Point(1, 2)).Value, "record value");
    }

    private sealed record Point(int X, int Y);
}
