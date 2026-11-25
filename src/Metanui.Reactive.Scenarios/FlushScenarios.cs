namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for the flush loop guards: reentrancy, scheduling and failures mid-flush.</summary>
public static class FlushScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "write during a flush schedules no extra flush",
            WriteDuringFlushSchedulesNoExtraFlush
        ),
        new Scenario("flush inside an apply is a no-op", FlushInsideApplyIsNoOp),
        new Scenario(
            "throwing scheduler does not block later writes",
            ThrowingSchedulerDoesNotBlockLaterWrites
        ),
        new Scenario(
            "throwing comparer still propagates committed signals",
            ThrowingComparerStillPropagates
        ),
        new Scenario(
            "write before the scheduler is configured is flushed by the new scheduler",
            WriteBeforeSchedulerIsConfiguredIsFlushedByNewScheduler
        ),
        new Scenario("using a null scheduler throws", UsingNullSchedulerThrows),
        new Scenario(
            "nested scenario runner restores the outer scheduler",
            NestedRunnerRestoresOuterScheduler
        ),
    ];

    private static void WriteDuringFlushSchedulesNoExtraFlush(IExpect expect)
    {
        var scheduler = new CountingScheduler(failFirst: false);
        var source = Reactivity.Signal(0);
        var relayed = Reactivity.Signal(0);

        Reactivity.Effect(() => source.Value, (value, previous) => relayed.Value = value + 1);

        // Flushed before the swap: the new scheduler is asked at once for work already queued.
        Reactivity.Flush();

        WithScheduler(scheduler, () =>
        {
            source.Value = 1;
            Reactivity.Flush();
        });

        expect.Equal(2, relayed.Value, "write in apply committed by the running flush");
        expect.Equal(1, scheduler.Requests, "flushes requested");
    }

    private static void FlushInsideApplyIsNoOp(IExpect expect)
    {
        var log = "";
        var source = Reactivity.Signal(0);
        var relayed = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                relayed.Value = value + 1;
                Reactivity.Flush();
                log += "a" + relayed.Value + ",";
            }
        );

        Reactivity.Effect(() => relayed.Value, (value, previous) => log += "b" + value + ",");

        Reactivity.Flush();

        expect.Equal("a0,b0,b1,", log, "the nested flush neither commits nor runs applies early");
    }

    private static void ThrowingSchedulerDoesNotBlockLaterWrites(IExpect expect)
    {
        var scheduler = new CountingScheduler(failFirst: true);
        var signal = Reactivity.Signal(0);
        Exception? error = null;

        WithScheduler(scheduler, () =>
        {
            // Clears a flush another scenario may have left scheduled.
            Reactivity.Flush();
            error = ScenarioRunner.Catch(() => signal.Value = 1);
            signal.Value = 2;
        });

        expect.IsTrue(
            error is InvalidOperationException,
            "the scheduler exception reaches the writer"
        );

        expect.Equal(2, scheduler.Requests, "the later write schedules again");

        Reactivity.Flush();

        expect.Equal(2, signal.Value, "the queued write commits");
    }

    private static void ThrowingComparerStillPropagates(IExpect expect)
    {
        var plain = Reactivity.Signal(0);
        var throwing = Reactivity.Signal(0, new ThrowingComparer());
        var doubled = Reactivity.Computed(() => plain.Value * 2);

        expect.Equal(0, doubled.Value, "initial value");

        plain.Value = 1;
        throwing.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(
            error is InvalidOperationException,
            "the comparer exception leaves the flush"
        );

        expect.Equal(2, doubled.Value, "the signal committed before the throw was propagated");
        expect.IsTrue(ScenarioRunner.Catch(Reactivity.Flush) is null, "the next flush is clean");
    }

    /// <summary>
    /// A host that writes before it configures its scheduler: the manual scheduler marked a flush as
    /// requested that never runs, and the new scheduler must still be asked for one.
    /// </summary>
    private static void WriteBeforeSchedulerIsConfiguredIsFlushedByNewScheduler(IExpect expect)
    {
        var scheduler = new CountingScheduler(failFirst: false);
        var applied = 0;
        var source = Reactivity.Signal(0);

        Reactivity.Effect(() => source.Value, (value, previous) => applied = value);
        Reactivity.Flush();
        source.Value = 1;

        WithScheduler(scheduler, () =>
            expect.Equal(1, scheduler.Requests, "the new scheduler is asked for the flush")
        );

        Reactivity.Flush();

        expect.Equal(1, applied, "the write made before the swap is applied");
    }

    private static void UsingNullSchedulerThrows(IExpect expect)
    {
        var error = ScenarioRunner.Catch(() => Reactivity.UseScheduler(Missing<IFlushScheduler>()));

        expect.IsTrue(error is ArgumentNullException, "a null scheduler is rejected");
    }

    private static void NestedRunnerRestoresOuterScheduler(IExpect expect)
    {
        var scheduler = new CountingScheduler(failFirst: false);
        var inner = new Scenario("inner", _ => { });
        var restored = false;

        WithScheduler(scheduler, () =>
        {
            ScenarioRunner.Run(inner, expect);
            restored = Reactivity.Scheduler == scheduler;
        });

        expect.IsTrue(restored, "the outer scheduler is in use after the nested run");
    }

    // Metano: `null!`/`default!` of a non-generic reference type loses its `!` (emitted as `null`,
    // which strict tsc rejects); for a type parameter it is kept (`null!`).
    private static T Missing<T>()
        where T : class => default!;

    private static void WithScheduler(IFlushScheduler scheduler, Action action)
    {
        var previous = Reactivity.Scheduler;

        Reactivity.UseScheduler(scheduler);

        try
        {
            action();
        }
        finally
        {
            Reactivity.UseScheduler(previous);
        }
    }

    /// <summary>Counts flush requests without running them; optionally throws on the first one.</summary>
    private sealed class CountingScheduler(bool failFirst) : IFlushScheduler
    {
        public int Requests { get; private set; }

        public void Schedule(Action flush)
        {
            Requests++;

            if (failFirst && Requests == 1)
            {
                throw new InvalidOperationException("Scheduler failed.");
            }
        }
    }

    private sealed class ThrowingComparer : IEqualityComparer<int>
    {
        public bool Equals(int x, int y) => throw new InvalidOperationException("Comparer failed.");

        public int GetHashCode(int value) => value;
    }
}
