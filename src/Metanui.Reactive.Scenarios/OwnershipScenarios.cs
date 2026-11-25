namespace Metanui.Reactive.Scenarios;

/// <summary>
/// Scenarios for ownership (<see cref="Reactivity.Root(Action{Action})" />), cleanups and
/// <see cref="Reactivity.Untrack{T}" />.
/// </summary>
public static class OwnershipScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "root dispose runs cleanups in reverse order",
            RootDisposeRunsCleanupsInReverse
        ),
        new Scenario("children are disposed when their owner reruns", ChildrenDisposedOnRerun),
        new Scenario("computed owned by a root is disposed with it", ComputedOwnedByRootIsDisposed),
        new Scenario("untrack does not subscribe", UntrackDoesNotSubscribe),
        new Scenario(
            "dispose during a flush skips the queued effects",
            DisposeDuringFlushSkipsQueuedEffects
        ),
        new Scenario(
            "write inside untrack in a computed throws",
            WriteInsideUntrackInComputedThrows
        ),
        new Scenario(
            "write in a root created in a computed throws",
            WriteInRootInsideComputedThrows
        ),
        new Scenario("write in a root nested in a root is allowed", WriteInNestedRootIsAllowed),
        new Scenario(
            "disposed queued effect neither applies nor resubscribes",
            DisposedQueuedEffectNeitherAppliesNorResubscribes
        ),
        new Scenario(
            "apply cleanup that disposes its effect skips the apply",
            ApplyCleanupThatDisposesItsEffectSkipsTheApply
        ),
        new Scenario(
            "compute cleanup that disposes its effect skips the compute",
            ComputeCleanupThatDisposesItsEffectSkipsTheCompute
        ),
        new Scenario(
            "computed disposed by its own cleanup keeps the value of that run",
            ComputedDisposedByItsOwnCleanupKeepsTheValueOfThatRun
        ),
    ];

    private static void RootDisposeRunsCleanupsInReverse(IExpect expect)
    {
        var log = "";

        var dispose = Reactivity.Root(dispose =>
        {
            Reactivity.OnCleanup(() => log += "1,");
            Reactivity.OnCleanup(() => log += "2,");
            Reactivity.OnCleanup(() => log += "3,");

            return dispose;
        });

        expect.Equal("", log, "no cleanup before dispose");

        dispose();

        expect.Equal("3,2,1,", log, "cleanups after dispose");
    }

    private static void ChildrenDisposedOnRerun(IExpect expect)
    {
        var alive = 0;
        var created = 0;
        var log = "";
        var count = Reactivity.Signal(1);

        Reactivity.Effect(
            () =>
            {
                var run = count.Value;

                Reactivity.Effect(
                    () =>
                    {
                        alive++;
                        created++;
                        Reactivity.OnCleanup(() =>
                        {
                            alive--;
                            log += "inner" + run + ",";
                        });

                        return run;
                    },
                    (value, previous) => { }
                );

                return run;
            },
            (value, previous) => { }
        );

        Reactivity.Flush();
        count.Value = 2;
        Reactivity.Flush();

        expect.Equal(2, created, "inner effects created");
        expect.Equal(1, alive, "inner effects alive after the rerun");
        expect.Equal("inner1,", log, "cleanup of the first inner effect");
    }

    private static void ComputedOwnedByRootIsDisposed(IExpect expect)
    {
        var runs = 0;
        var source = Reactivity.Signal(0);

        Action dispose = () => { };

        // Metano #779: tuple deconstruction (`var (a, b) = ...`) is not supported (MS0001)
        var computed = Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;

            return Reactivity.Computed(() =>
            {
                runs++;

                return source.Value;
            });
        });

        // Owned by the scenario root, outside the inner root: it keeps pulling the computed.
        Reactivity.Effect(() => computed.Value, (value, previous) => { });

        Reactivity.Flush();
        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(2, runs, "runs while the root is alive");

        dispose();
        source.Value = 2;
        Reactivity.Flush();

        expect.Equal(2, runs, "runs after the root is disposed");
    }

    private static void UntrackDoesNotSubscribe(IExpect expect)
    {
        var computes = 0;
        var tracked = Reactivity.Signal(0);
        var untracked = Reactivity.Signal(0);

        Reactivity.Effect(
            () =>
            {
                computes++;

                return tracked.Value + Reactivity.Untrack(() => untracked.Value);
            },
            (value, previous) => { }
        );

        Reactivity.Flush();
        untracked.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computes, "computes after writing the untracked signal");

        tracked.Value = 1;
        Reactivity.Flush();

        expect.Equal(2, computes, "computes after writing the tracked signal");
    }

    // Effect A is created before the inner root, so the shared write queues A's apply first.
    private static void DisposeDuringFlushSkipsQueuedEffects(IExpect expect)
    {
        var appliesOfB = 0;
        var source = Reactivity.Signal(0);
        Action disposeInner = () => { };

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                if (value > 0)
                {
                    disposeInner();
                }
            }
        );

        disposeInner = Reactivity.Root(dispose =>
        {
            Reactivity.Effect(() => source.Value, (value, previous) => appliesOfB++);

            return dispose;
        });

        Reactivity.Flush();

        expect.Equal(1, appliesOfB, "applies of B before the write");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, appliesOfB, "applies of B after A disposed its root");
    }

    private static void WriteInsideUntrackInComputedThrows(IExpect expect)
    {
        var target = Reactivity.Signal(0);

        var writer = Reactivity.Computed(() =>
        {
            Reactivity.Untrack(() => target.Value = 1);

            return 0;
        });

        // Metano #773: a discard assignment `_ = expr` is emitted as an assignment to an undeclared `_`
        var error = ScenarioRunner.Catch(() =>
        {
            var value = writer.Value;
        });

        expect.IsTrue(error is InvalidOperationException, "the write inside untrack throws");
    }

    // Solid 2.0.4 throws here: the root's owner chain includes the computed, so the write still
    // happens inside the computation.
    private static void WriteInRootInsideComputedThrows(IExpect expect)
    {
        var target = Reactivity.Signal(0);

        var writer = Reactivity.Computed(() =>
        {
            Reactivity.Root(dispose => target.Value = 1);

            return 0;
        });

        var error = ScenarioRunner.Catch(() =>
        {
            var value = writer.Value;
        });

        expect.IsTrue(error is InvalidOperationException, "the write in the nested root throws");
    }

    private static void WriteInNestedRootIsAllowed(IExpect expect)
    {
        var target = Reactivity.Signal(0);

        var error = ScenarioRunner.Catch(() =>
            Reactivity.Root(outer => Reactivity.Root(inner => target.Value = 1))
        );

        Reactivity.Flush();

        expect.IsTrue(error is null, "the write in the nested root does not throw");
        expect.Equal(1, target.Value, "committed value");
    }

    // No flush runs between the creation and the disposal, so the first apply is still queued when
    // the root is disposed. Memory release is not observable here: the retain probe
    // (bench/reactivity/probes/retain.ts) checks it.
    private static void DisposedQueuedEffectNeitherAppliesNorResubscribes(IExpect expect)
    {
        var marker = new Marker("captured");
        var computes = 0;
        var applies = 0;
        var cleanups = 0;
        var source = Reactivity.Signal(0);

        var dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.Effect(
                () =>
                {
                    computes++;
                    Reactivity.OnCleanup(() => cleanups++);

                    return marker.Name + source.Value;
                },
                (value, previous) =>
                {
                    applies++;
                    Reactivity.OnCleanup(() => cleanups++);
                }
            );

            return disposeRoot;
        });

        dispose();

        expect.Equal(1, cleanups, "cleanups run by the disposal");

        Reactivity.Flush();

        expect.Equal(0, applies, "applies after the flush that drains the queue");
        expect.Equal(1, cleanups, "cleanups after the flush that drains the queue");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computes, "computes after writing the source");
        expect.Equal(0, applies, "applies after writing the source");
        expect.Equal(1, cleanups, "cleanups after writing the source");
    }

    // The cleanup registered by the first apply runs before the second one and disposes the effect.
    private static void ApplyCleanupThatDisposesItsEffectSkipsTheApply(IExpect expect)
    {
        var applies = 0;
        var source = Reactivity.Signal(0);
        Action dispose = () => { };

        dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.Effect(
                () => source.Value,
                (value, previous) =>
                {
                    applies++;
                    Reactivity.OnCleanup(() => dispose());
                }
            );

            return disposeRoot;
        });

        Reactivity.Flush();
        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, applies, "applies after the cleanup disposed the effect");
    }

    // The cleanup registered by the first compute runs before the second one and disposes the effect.
    private static void ComputeCleanupThatDisposesItsEffectSkipsTheCompute(IExpect expect)
    {
        var computes = 0;
        var source = Reactivity.Signal(0);
        Action dispose = () => { };

        dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.Effect(
                () =>
                {
                    computes++;
                    Reactivity.OnCleanup(() => dispose());

                    return source.Value;
                },
                (value, previous) => { }
            );

            return disposeRoot;
        });

        Reactivity.Flush();
        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computes, "computes after the cleanup disposed the effect");
    }

    // The cleanup registered by the first run disposes the computed before the second run, which
    // still runs, and a later read returns the value of that run.
    private static void ComputedDisposedByItsOwnCleanupKeepsTheValueOfThatRun(IExpect expect)
    {
        var runs = 0;
        var source = Reactivity.Signal(0);
        Action dispose = () => { };

        var computed = Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;

            return Reactivity.Computed(() =>
            {
                runs++;
                Reactivity.OnCleanup(() => dispose());

                return source.Value * 10;
            });
        });

        expect.Equal(0, computed.Value, "initial value");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(10, computed.Value, "value of the run after the cleanup disposed it");

        source.Value = 2;
        Reactivity.Flush();

        expect.Equal(10, computed.Value, "a later read returns the frozen value");
        expect.Equal(2, runs, "runs");
    }

    private sealed record Marker(string Name);
}
