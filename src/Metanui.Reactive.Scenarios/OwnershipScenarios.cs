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
        new Scenario(
            "computed disposed during its own run disposes what that run created next",
            ComputedDisposedDuringItsRunDisposesWhatTheRunCreated
        ),
        new Scenario(
            "effect disposed during its own compute disposes what that compute created next",
            EffectDisposedDuringItsComputeDisposesWhatTheComputeCreated
        ),
        new Scenario(
            "computed that loses its last observer unlinks and reruns on the next read",
            ComputedLosingItsLastObserverUnlinksAndRerunsOnTheNextRead
        ),
        new Scenario(
            "computed without dependencies that loses its last observer disposes what it created",
            ComputedWithoutDepsLosingItsLastObserverDisposesWhatItCreated
        ),
        new Scenario(
            "root disposed by its own body disposes what the body created next",
            RootDisposedByItsBodyDisposesWhatTheBodyCreated
        ),
        new Scenario(
            "error boundary disposed by its own body disposes what the body created next",
            BoundaryDisposedByItsBodyDisposesWhatTheBodyCreated
        ),
        new Scenario(
            "error boundary disposed by its own body disposes what it created before its handler runs",
            BoundaryDisposedByItsBodyDisposesWhatItCreatedBeforeItsHandler
        ),
        new Scenario(
            "computed whose last observer is disposed during its run keeps that run",
            ComputedWhoseLastObserverIsDisposedDuringItsRunKeepsThatRun
        ),
        new Scenario(
            "pending computed disposed during its own dirty check keeps its last value",
            PendingComputedDisposedDuringItsCheckKeepsItsLastValue
        ),
        new Scenario(
            "pending computed disposed during an observer's dirty check keeps its last value",
            PendingComputedDisposedDuringAnObserversCheckKeepsItsLastValue
        ),
        new Scenario(
            "effect disposed during its dirty check fails nothing and leaves its dependencies unlinked",
            EffectDisposedDuringItsCheckLeavesItsDependenciesUnlinked
        ),
        new Scenario(
            "effect disposed during a multi-level dirty check leaves no computed linked",
            EffectDisposedDuringMultiLevelCheckLeavesNoComputedLinked
        ),
        new Scenario(
            "observer sharing a computed with an effect disposed during its check sees the change",
            ObserverSharingAComputedWithAnEffectDisposedDuringItsCheckSeesTheChange
        ),
        new Scenario(
            "computed that disposes itself and flushes during its run reads its last value",
            ComputedThatDisposesItselfAndFlushesDuringItsRunReadsItsLastValue
        ),
        new Scenario(
            "computed disposed during a dirty check and marked by a nested flush reads its last value",
            ComputedDisposedDuringACheckAndMarkedByANestedFlushReadsItsLastValue
        ),
    ];

    private static void RootDisposeRunsCleanupsInReverse(IExpect expect)
    {
        var log = "";

        var dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.OnCleanup(() => log += "1,");
            Reactivity.OnCleanup(() => log += "2,");
            Reactivity.OnCleanup(() => log += "3,");

            return disposeRoot;
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

        var (dispose, computed) = Reactivity.Root(disposeRoot =>
            (
                disposeRoot,
                Reactivity.Computed(() =>
                {
                    runs++;

                    return source.Value;
                })
            )
        );

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

        var error = ScenarioRunner.Catch(() => _ = writer.Value);

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

    private static void ComputedDisposedDuringItsRunDisposesWhatTheRunCreated(IExpect expect)
    {
        var late = new LateChildren();
        var source = Reactivity.Signal(0);

        var computed = Reactivity.Root(disposeRoot =>
            Reactivity.Computed(() =>
            {
                var value = source.Value;

                if (value == 1)
                {
                    disposeRoot();
                    late.Create();
                }

                return value;
            })
        );

        expect.Equal(0, computed.Value, "initial value");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computed.Value, "the run that disposed the computed completes");

        ExpectLateChildrenGone(expect, late);
    }

    private static void EffectDisposedDuringItsComputeDisposesWhatTheComputeCreated(IExpect expect)
    {
        var late = new LateChildren();
        var source = Reactivity.Signal(0);

        Reactivity.Root(disposeRoot =>
            Reactivity.Effect(
                () =>
                {
                    var value = source.Value;

                    if (value == 1)
                    {
                        disposeRoot();
                        late.Create();
                    }

                    return value;
                },
                (value, previous) => { }
            )
        );

        Reactivity.Flush();
        source.Value = 1;
        Reactivity.Flush();

        ExpectLateChildrenGone(expect, late);
    }

    /// <summary>
    /// Spec 4.2 (Solid <c>unobserved</c>): a computed whose owner lives but whose last subscriber is
    /// disposed unlinks its dependencies and disposes the cleanups of its last run; a write no longer
    /// runs it, the next read runs it again, and a new observer is updated as before.
    /// </summary>
    private static void ComputedLosingItsLastObserverUnlinksAndRerunsOnTheNextRead(IExpect expect)
    {
        var runs = 0;
        var cleanups = 0;
        var seen = 0;
        var source = Reactivity.Signal(1);

        var doubled = Reactivity.Computed(() =>
        {
            runs++;
            Reactivity.OnCleanup(() => cleanups++);

            return source.Value * 2;
        });

        var dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.Effect(() => doubled.Value, (value, previous) => { });

            return disposeRoot;
        });

        Reactivity.Flush();
        dispose();

        expect.Equal(1, cleanups, "losing its last observer runs the cleanup of its last run");

        source.Value = 2;
        Reactivity.Flush();

        expect.Equal(1, runs, "a write to its old dependency no longer runs it");
        expect.Equal(4, doubled.Value, "the next read runs it again");
        expect.Equal(2, runs, "runs after the read");

        Reactivity.Effect(() => doubled.Value, (value, previous) => seen = value);
        Reactivity.Flush();
        source.Value = 3;
        Reactivity.Flush();

        expect.Equal(6, seen, "a new observer is updated");
        expect.Equal(2, cleanups, "the rerun disposed the cleanup of the read's run");
    }

    /// <summary>
    /// Spec 4.2 (Solid <c>unobserved</c>): a computed that loses its last subscriber disposes the
    /// cleanups of its last run even while its owner lives, and the next read runs it again. Having
    /// no dependency to drop does not exempt it.
    /// </summary>
    private static void ComputedWithoutDepsLosingItsLastObserverDisposesWhatItCreated(
        IExpect expect
    )
    {
        var runs = 0;
        var cleanups = 0;

        var constant = Reactivity.Computed(() =>
        {
            runs++;
            Reactivity.OnCleanup(() => cleanups++);

            return 1;
        });

        var dispose = Reactivity.Root(disposeRoot =>
        {
            Reactivity.Effect(() => constant.Value, (value, previous) => { });

            return disposeRoot;
        });

        Reactivity.Flush();
        dispose();

        expect.Equal(1, cleanups, "losing its last observer runs the cleanup of its last run");
        expect.Equal(1, constant.Value, "value read again");
        expect.Equal(2, runs, "the next read runs it again");
    }

    private static void RootDisposedByItsBodyDisposesWhatTheBodyCreated(IExpect expect)
    {
        var late = new LateChildren();

        Reactivity.Root(disposeRoot =>
        {
            disposeRoot();
            late.Create();
        });

        ExpectLateChildrenGone(expect, late);
    }

    /// <summary>
    /// The boundary body disposes the root that owns the boundary, creates an effect and a cleanup,
    /// then throws: the handler still receives the error, and nothing the body created after the
    /// disposal outlives it.
    /// </summary>
    private static void BoundaryDisposedByItsBodyDisposesWhatTheBodyCreated(IExpect expect)
    {
        var caught = 0;
        var late = new LateChildren();

        Reactivity.Root(disposeRoot =>
            Reactivity.ErrorBoundary(
                () =>
                {
                    disposeRoot();
                    late.Create();

                    throw new InvalidOperationException("body failed");
                },
                error => caught++
            )
        );

        expect.Equal(1, caught, "the handler received the body error");

        ExpectLateChildrenGone(expect, late);
    }

    /// <summary>
    /// The boundary body disposes its owner, registers a cleanup, then throws. What the body created
    /// after the disposal is disposed when the body ends, before the handler runs, as for a
    /// computation whose run disposed it.
    /// </summary>
    private static void BoundaryDisposedByItsBodyDisposesWhatItCreatedBeforeItsHandler(
        IExpect expect
    )
    {
        var log = "";

        Reactivity.Root(disposeRoot =>
            Reactivity.ErrorBoundary(
                () =>
                {
                    disposeRoot();
                    Reactivity.OnCleanup(() => log += "cleanup,");

                    throw new InvalidOperationException("body failed");
                },
                error => log += "handler,"
            )
        );

        expect.Equal("cleanup,handler,", log, "order");
    }

    /// <summary>
    /// <c>counted</c> is read directly while dirty, and its run disposes <c>reader</c>, its only
    /// subscriber, after registering a cleanup and before reading any dependency. That unwatch must
    /// leave the run in progress alone: its cleanup stays registered and the computed is not marked
    /// for another run.
    /// </summary>
    private static void ComputedWhoseLastObserverIsDisposedDuringItsRunKeepsThatRun(IExpect expect)
    {
        var runs = 0;
        var cleanups = 0;
        var disposeOnRun = false;
        var disposeReader = () => { };
        var source = Reactivity.Signal(0);

        var counted = Reactivity.Computed(() =>
        {
            runs++;
            Reactivity.OnCleanup(() => cleanups++);

            if (disposeOnRun)
            {
                disposeReader();
            }

            return source.Value;
        });

        var reader = Reactivity.Root(disposeRoot =>
        {
            disposeReader = disposeRoot;

            return Reactivity.Computed(() => counted.Value + 1);
        });

        expect.Equal(1, reader.Peek(), "initial value");

        disposeOnRun = true;
        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, counted.Peek(), "value of the run that disposed its subscriber");

        disposeOnRun = false;

        expect.Equal(1, cleanups, "only the cleanup of the previous run ran");
        expect.Equal(1, counted.Peek(), "value read again");
        expect.Equal(2, runs, "the unwatch did not mark it for another run");
    }

    /// <summary>
    /// The dirty check of <c>reader</c> updates <c>inner</c>, whose cleanup disposes the root that owns
    /// both. The check still reports a change, but the disposed reader must not run its released
    /// function: it keeps its last value (spec 4.5).
    /// </summary>
    private static void PendingComputedDisposedDuringItsCheckKeepsItsLastValue(IExpect expect)
    {
        var runs = 0;
        var source = Reactivity.Signal(0);
        var graph = new DisposingGraph(source);

        var reader = Reactivity.Root(disposeRoot =>
        {
            graph.Dispose = disposeRoot;

            var inner = graph.CreateInner();

            return Reactivity.Computed(() =>
            {
                runs++;

                return inner.Value + 1;
            });
        });

        expect.Equal(1, reader.Peek(), "initial value");

        source.Value = 1;
        Reactivity.Flush();

        var error = ScenarioRunner.Catch(() => _ = reader.Peek());

        expect.IsTrue(error is null, "the read that disposed it does not throw");
        expect.Equal(1, reader.Peek(), "it keeps its last value");
        expect.Equal(1, runs, "its released function never runs");
    }

    /// <summary>
    /// The variant of <see cref="PendingComputedDisposedDuringItsCheckKeepsItsLastValue" /> one level
    /// deeper: an effect's dirty check walks through <c>reader</c> to <c>inner</c>, whose update
    /// disposes <c>reader</c>. The walk must not run the disposed reader on its way back.
    /// </summary>
    private static void PendingComputedDisposedDuringAnObserversCheckKeepsItsLastValue(
        IExpect expect
    )
    {
        var runs = 0;
        var applied = 0;
        var source = Reactivity.Signal(0);
        var graph = new DisposingGraph(source);

        var reader = Reactivity.Root(disposeRoot =>
        {
            graph.Dispose = disposeRoot;

            var inner = graph.CreateInner();

            return Reactivity.Computed(() =>
            {
                runs++;

                return inner.Value + 1;
            });
        });

        Reactivity.Effect(() => reader.Value, (value, previous) => applied = value);
        Reactivity.Flush();

        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush does not fail");
        expect.Equal(1, applied, "the effect keeps the last value");
        expect.Equal(1, reader.Peek(), "the reader keeps its last value");
        expect.Equal(1, runs, "its released function never runs");
    }

    /// <summary>
    /// An effect reads <c>first</c>, then <c>second</c>, which only it reads. The update of
    /// <c>first</c> (equal result) disposes the effect. The disposal keeps the effect's links until
    /// the check ends, so the check goes on to <c>second</c> through a live link and updates it once,
    /// then the effect's links go and <c>second</c> ends unlinked: a later write does not run it.
    /// </summary>
    private static void EffectDisposedDuringItsCheckLeavesItsDependenciesUnlinked(IExpect expect)
    {
        var secondRuns = 0;
        var applies = 0;
        var source = Reactivity.Signal(0);
        var dispose = () => { };

        var first = Reactivity.Computed(() =>
        {
            var value = source.Value;

            Reactivity.OnCleanup(() =>
            {
                if (value == 0)
                {
                    dispose();
                }
            });

            return 0;
        });

        var second = Reactivity.Computed(() =>
        {
            secondRuns++;

            return source.Value;
        });

        Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;
            Reactivity.Effect(() => first.Value + second.Value, (value, previous) => applies++);
        });

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);
        var runsAfterCheck = secondRuns;

        source.Value = 2;
        Reactivity.Flush();

        expect.IsTrue(error is null, "the flush does not fail");
        expect.Equal(1, applies, "the disposed effect never applies again");
        expect.Equal(runsAfterCheck, secondRuns, "the computed only the effect read is unlinked");
    }

    /// <summary>
    /// An effect is the only observer of <c>middle</c>, which reads <c>inner</c>. The update of
    /// <c>inner</c> disposes the effect two levels up, so on the way back the walk must not update
    /// <c>middle</c> as if it were still observed, and <c>middle</c> ends unlinked.
    /// </summary>
    private static void EffectDisposedDuringMultiLevelCheckLeavesNoComputedLinked(IExpect expect)
    {
        var middleRuns = 0;
        var applies = 0;
        var source = Reactivity.Signal(0);
        var graph = new DisposingGraph(source);
        var inner = graph.CreateInner();

        var middle = Reactivity.Computed(() =>
        {
            middleRuns++;

            return inner.Value * 10;
        });

        Reactivity.Root(disposeRoot =>
        {
            graph.Dispose = disposeRoot;
            Reactivity.Effect(() => middle.Value, (value, previous) => applies++);
        });

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);
        var runsAfterCheck = middleRuns;

        source.Value = 2;
        Reactivity.Flush();

        expect.IsTrue(error is null, "the flush does not fail");
        expect.Equal(1, applies, "the disposed effect never applies again");
        expect.Equal(runsAfterCheck, middleRuns, "the computed only the effect read is unlinked");
    }

    /// <summary>
    /// Two effects read <c>middle</c>; the first one created runs its dirty check first, and the
    /// update of <c>inner</c> disposes it. <c>middle</c> changes on the way back, and the other
    /// effect must still be told, although the check that updated <c>middle</c> belonged to an
    /// effect that is gone.
    /// </summary>
    private static void ObserverSharingAComputedWithAnEffectDisposedDuringItsCheckSeesTheChange(
        IExpect expect
    )
    {
        var seen = 0;
        var source = Reactivity.Signal(0);
        var graph = new DisposingGraph(source);
        var inner = graph.CreateInner();
        var middle = Reactivity.Computed(() => inner.Value * 10);

        Reactivity.Root(disposeRoot =>
        {
            graph.Dispose = disposeRoot;
            Reactivity.Effect(() => middle.Value, (value, previous) => { });
        });

        Reactivity.Effect(() => middle.Value, (value, previous) => seen = value);
        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush does not fail");
        expect.Equal(10, seen, "the other effect applies the new value");
    }

    /// <summary>
    /// <c>frozen</c> disposes its own root during its first run, then reads <c>middle</c> (which links
    /// it again until the run ends) and calls <see cref="Reactivity.Flush" />. That nested flush
    /// commits the pending write and marks <c>frozen</c> pending through <c>middle</c>. Once the run
    /// ends and its links are gone, a read must return the value of that run, not check dependencies
    /// it no longer has.
    /// </summary>
    private static void ComputedThatDisposesItselfAndFlushesDuringItsRunReadsItsLastValue(
        IExpect expect
    )
    {
        var source = Reactivity.Signal(1);
        var middle = Reactivity.Computed(() => source.Value);

        var frozen = Reactivity.Root(disposeRoot =>
            Reactivity.Computed(() =>
            {
                disposeRoot();

                var value = middle.Value;

                Reactivity.Flush();

                return value * 10;
            })
        );

        source.Value = 2;

        expect.Equal(10, frozen.Value, "value of the run that disposed it");

        var error = ScenarioRunner.Catch(() => _ = frozen.Value);

        expect.IsTrue(error is null, "a later read does not throw");
        expect.Equal(10, frozen.Value, "it keeps the value of that run");
    }

    /// <summary>
    /// The dirty check of <c>reader</c> updates <c>inner</c>, whose cleanup disposes the root owning
    /// <c>frozen</c>, writes <c>source</c> and flushes (allowed outside a flush, spec 4.6). The
    /// disposed <c>frozen</c> keeps its links until the check ends, so that nested flush marks it
    /// pending through <c>middle</c>. Once the check ends and its links are gone, a read must return
    /// its last value, not walk dependencies it no longer has.
    /// </summary>
    private static void ComputedDisposedDuringACheckAndMarkedByANestedFlushReadsItsLastValue(
        IExpect expect
    )
    {
        var trigger = Reactivity.Signal(0);
        var source = Reactivity.Signal(0);
        var middle = Reactivity.Computed(() => source.Value + 1);
        var disposeFrozen = () => { };

        var frozen = Reactivity.Root(disposeRoot =>
        {
            disposeFrozen = disposeRoot;

            return Reactivity.Computed(() => middle.Value * 10);
        });

        var inner = Reactivity.Computed(() =>
        {
            var value = trigger.Value;

            Reactivity.OnCleanup(() =>
            {
                if (value == 0)
                {
                    disposeFrozen();
                    source.Value = 1;
                    Reactivity.Flush();
                }
            });

            return value;
        });

        var reader = Reactivity.Computed(() => inner.Value);

        expect.Equal(10, frozen.Peek(), "initial value");
        expect.Equal(0, reader.Peek(), "initial reader value");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, reader.Peek(), "the reader sees the change");

        var error = ScenarioRunner.Catch(() => _ = frozen.Peek());

        expect.IsTrue(error is null, "the read of the disposed computed does not throw");
        expect.Equal(10, frozen.Peek(), "it keeps its last value");
    }

    private static void ExpectLateChildrenGone(IExpect expect, LateChildren late)
    {
        Reactivity.Flush();
        late.Source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, late.Cleanups, "the cleanup registered after the disposal ran");
        expect.Equal(0, late.Applies, "the effect created after the disposal never applied");
        expect.Equal(1, late.Computes, "the effect created after the disposal never reran");
    }

    private sealed record Marker(string Name);

    /// <summary>
    /// A computed (<see cref="CreateInner" />) that reads a source and, when a change
    /// re-runs it, calls <see cref="Dispose" /> from the cleanup of its first run: a dependency whose
    /// update disposes an owner in the middle of a dirty check.
    /// </summary>
    private sealed class DisposingGraph(Signal<int> source)
    {
        public Action Dispose { get; set; } = () => { };

        public Computed<int> CreateInner() =>
            Reactivity.Computed(() =>
            {
                var value = source.Value;

                Reactivity.OnCleanup(() =>
                {
                    if (value == 0)
                    {
                        Dispose();
                    }
                });

                return value;
            });
    }

    /// <summary>
    /// What a run creates after it disposed its own owner: an effect and a cleanup, counting what
    /// they do afterwards.
    /// </summary>
    private sealed class LateChildren
    {
        public Signal<int> Source { get; } = Reactivity.Signal(0);

        public int Computes { get; private set; }

        public int Applies { get; private set; }

        public int Cleanups { get; private set; }

        public void Create()
        {
            Reactivity.Effect(
                () =>
                {
                    Computes++;

                    return Source.Value;
                },
                (value, previous) => Applies++
            );

            Reactivity.OnCleanup(() => Cleanups++);
        }
    }
}
