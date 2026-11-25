namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for split effects (<see cref="Reactivity.Effect{T}" />) and the flush passes.</summary>
public static class EffectScenarios
{
    private const string PassLimitMessage =
        "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";

    public static Scenario[] All { get; } =
    [
        new Scenario(
            "effect computes on creation and applies on flush",
            ComputeRunsOnCreationApplyOnFlush
        ),
        new Scenario("apply receives the previous value", ApplyReceivesPrevious),
        new Scenario("applies run after all computes", AppliesRunAfterAllComputes),
        new Scenario("apply is untracked", ApplyIsUntracked),
        new Scenario("apply cleanup runs before the next apply", ApplyCleanupRunsBeforeNextApply),
        new Scenario(
            "cleanup in a computation nested in an apply stays out of the apply",
            NestedCleanupStaysOutOfApply
        ),
        new Scenario("write in apply schedules another pass", WriteInApplySchedulesAnotherPass),
        new Scenario("effect write loop throws", EffectWriteLoopThrows),
        new Scenario("equal record write does not rerun the effect", EqualRecordWriteDoesNotRerun),
    ];

    // A reference type: the first apply gets `default` as previous, which is null on every
    // platform, whereas `default(int)` is 0 on .NET and null in TypeScript.
    private static void ComputeRunsOnCreationApplyOnFlush(IExpect expect)
    {
        var computes = 0;
        var applies = 0;
        var appliedValue = "";
        var previousWasDefault = false;
        var name = new Signal<string>("first");

        Reactivity.Effect(
            () =>
            {
                computes++;

                return name.Value;
            },
            (value, previous) =>
            {
                applies++;
                appliedValue = value;
                previousWasDefault = previous is null;
            }
        );

        expect.Equal(1, computes, "computes after creation");
        expect.Equal(0, applies, "applies after creation");

        Reactivity.Flush();

        expect.Equal(1, computes, "computes after flush");
        expect.Equal(1, applies, "applies after flush");
        expect.Equal("first", appliedValue, "applied value");
        expect.IsTrue(previousWasDefault, "applied previous is default");
    }

    private static void ApplyReceivesPrevious(IExpect expect)
    {
        var appliedValue = -1;
        // The previous value is typed `T | null` in TypeScript (default(T) is null there).
        int? appliedPrevious = null;
        var count = new Signal<int>(1);

        Reactivity.Effect(
            () => count.Value,
            (value, previous) =>
            {
                appliedValue = value;
                appliedPrevious = previous;
            }
        );

        Reactivity.Flush();
        count.Value = 2;
        Reactivity.Flush();

        expect.Equal(2, appliedValue, "applied value");
        expect.Equal<int?>(1, appliedPrevious, "applied previous");
    }

    private static void AppliesRunAfterAllComputes(IExpect expect)
    {
        var log = "";
        var count = new Signal<int>(0);

        Reactivity.Effect(
            () =>
            {
                log += "c1,";

                return count.Value;
            },
            (value, previous) => log += "a1,"
        );

        Reactivity.Effect(
            () =>
            {
                log += "c2,";

                return count.Value;
            },
            (value, previous) => log += "a2,"
        );

        Reactivity.Flush();
        log = "";
        count.Value = 1;
        Reactivity.Flush();

        expect.Equal("c1,c2,a1,a2,", log, "order of computes and applies");
    }

    private static void ApplyIsUntracked(IExpect expect)
    {
        var computes = 0;
        var applies = 0;
        var tracked = new Signal<int>(0);
        var readInApply = new Signal<int>(0);

        Reactivity.Effect(
            () =>
            {
                computes++;

                return tracked.Value;
            },
            (value, previous) =>
            {
                applies++;

                var untracked = readInApply.Value;
            }
        );

        Reactivity.Flush();
        readInApply.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computes, "computes after writing a signal read only in apply");
        expect.Equal(1, applies, "applies after writing a signal read only in apply");
    }

    private static void ApplyCleanupRunsBeforeNextApply(IExpect expect)
    {
        var log = "";
        var count = new Signal<int>(1);

        Reactivity.Effect(
            () => count.Value,
            (value, previous) =>
            {
                log += "apply" + value + ",";
                Reactivity.OnCleanup(() => log += "cleanup" + value + ",");
            }
        );

        Reactivity.Flush();
        count.Value = 2;
        Reactivity.Flush();

        expect.Equal("apply1,cleanup1,apply2,", log, "cleanup order");
    }

    private static void NestedCleanupStaysOutOfApply(IExpect expect)
    {
        var log = "";
        var count = new Signal<int>(1);

        Reactivity.Effect(
            () => count.Value,
            (value, previous) =>
            {
                log += "apply" + value + ",";

                var nested = new Computed<int>(() =>
                {
                    Reactivity.OnCleanup(() => log += "computed-cleanup,");

                    return value;
                });

                var read = nested.Value;

                Reactivity.Effect(
                    () =>
                    {
                        Reactivity.OnCleanup(() => log += "effect-cleanup,");

                        return read;
                    },
                    (innerValue, innerPrevious) => { }
                );
            }
        );

        Reactivity.Flush();
        count.Value = 2;
        Reactivity.Flush();

        expect.Equal("apply1,apply2,", log, "no nested cleanup ran with the outer apply");
    }

    private static void WriteInApplySchedulesAnotherPass(IExpect expect)
    {
        var lastApplied = -1;
        var source = new Signal<int>(1);
        var relayed = new Signal<int>(0);

        Reactivity.Effect(() => source.Value, (value, previous) => relayed.Value = value * 10);
        Reactivity.Effect(() => relayed.Value, (value, previous) => lastApplied = value);

        Reactivity.Flush();

        expect.Equal(10, lastApplied, "value applied by the reader of the relayed signal");
    }

    private static void EffectWriteLoopThrows(IExpect expect)
    {
        var count = new Signal<int>(0);

        Reactivity.Effect(() => count.Value, (value, previous) => count.Value = value + 1);

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is InvalidOperationException, "the pass limit throws");
        expect.Equal(PassLimitMessage, error?.Message, "pass limit message");
        expect.IsTrue(ScenarioRunner.Catch(Reactivity.Flush) is null, "the next flush is clean");
    }

    private static void EqualRecordWriteDoesNotRerun(IExpect expect)
    {
        var computes = 0;
        var applies = 0;
        var point = new Signal<Point>(new Point(1, 2));

        Reactivity.Effect(
            () =>
            {
                computes++;

                return point.Value;
            },
            (value, previous) => applies++
        );

        Reactivity.Flush();
        point.Value = new Point(1, 2);
        Reactivity.Flush();

        expect.Equal(1, computes, "computes after an equal write");
        expect.Equal(1, applies, "applies after an equal write");
    }

    private sealed record Point(int X, int Y);
}
