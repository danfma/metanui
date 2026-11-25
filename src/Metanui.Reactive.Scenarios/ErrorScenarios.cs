namespace Metanui.Reactive.Scenarios;

/// <summary>
/// Scenarios for errors: cached computed errors, <see cref="Reactivity.ErrorBoundary" />, unhandled
/// effect errors, throwing cleanups and the scenario runner's own failure handling.
/// </summary>
public static class ErrorScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "computed rethrows its error until a dependency changes",
            ComputedRethrowsUntilDependencyChanges
        ),
        new Scenario(
            "errored computed without dependencies retries on a tracked re-read after a flush",
            ErroredComputedWithoutDepsRetriesOnTrackedReread
        ),
        new Scenario(
            "retry that recovers an errored computed updates its other observers",
            RetryThatRecoversUpdatesOtherObservers
        ),
        new Scenario(
            "error raised in a multi-level dirty check reaches the reader and later walks stay correct",
            ErrorInMultiLevelDirtyCheckReachesReader
        ),
        new Scenario("boundary receives an effect apply error", BoundaryReceivesEffectError),
        new Scenario(
            "boundary receives an effect compute error",
            BoundaryReceivesEffectComputeError
        ),
        new Scenario("unhandled effect error escapes the flush", UnhandledEffectErrorEscapesFlush),
        new Scenario(
            "throwing effect defers the others to the next flush",
            ThrowingEffectDefersOthersToNextFlush
        ),
        new Scenario(
            "work left by a failed compute runs on the next flush",
            WorkLeftByFailedComputeRunsOnNextFlush
        ),
        new Scenario(
            "throwing effect that writes what it reads stops at the pass limit",
            ThrowingSelfWritingEffectStopsAtPassLimit
        ),
        new Scenario(
            "effect that throws on every change never hits the pass limit",
            EffectThrowingOnEveryChangeNeverHitsPassLimit
        ),
        new Scenario(
            "resume made stale by a direct flush spends no pass budget",
            StaleResumeSpendsNoPassBudget
        ),
        new Scenario(
            "apply after a skipped apply receives the last applied value",
            ApplyAfterSkippedApplyReceivesLastApplied
        ),
        new Scenario(
            "throwing apply cleanup still runs the others and reaches the boundary",
            ThrowingApplyCleanupReachesBoundary
        ),
        new Scenario(
            "unhandled apply cleanup error escapes after the others ran",
            UnhandledApplyCleanupErrorEscapes
        ),
        new Scenario(
            "apply cleanup that disposes its effect and throws reaches the boundary",
            SelfDisposingApplyCleanupErrorReachesBoundary
        ),
        new Scenario(
            "effect compute that disposes its effect and throws reaches the boundary",
            SelfDisposingComputeErrorReachesBoundary
        ),
        new Scenario(
            "throwing cleanup does not abort the disposal",
            ThrowingCleanupDoesNotAbortDisposal
        ),
        new Scenario(
            "throwing cleanup in a rerun is rethrown after the flush",
            ThrowingCleanupInRerunIsRethrownAfterFlush
        ),
        new Scenario(
            "disposer called in a computed defers its cleanup error to the flush",
            DisposerInComputedDefersCleanupError
        ),
        new Scenario(
            "disposer called in an effect compute keeps its cleanup error from the boundary",
            DisposerInEffectComputeKeepsCleanupErrorFromBoundary
        ),
        new Scenario(
            "disposer called in a boundary body keeps its cleanup error from the boundary",
            DisposerInBoundaryBodyKeepsCleanupErrorFromBoundary
        ),
        new Scenario(
            "write from a cleanup during disposal is allowed",
            WriteFromCleanupDuringDisposalIsAllowed
        ),
        new Scenario(
            "computed that disposes itself mid-run keeps no dependency",
            SelfDisposingComputedKeepsNoDependency
        ),
        new Scenario(
            "runner keeps the scenario error and drains leftover writes",
            RunnerKeepsScenarioErrorAndDrainsLeftovers
        ),
    ];

    private static void ComputedRethrowsUntilDependencyChanges(IExpect expect)
    {
        var runs = 0;
        var source = Reactivity.Signal(0);

        var quotient = Reactivity.Computed(() =>
        {
            runs++;

            var divisor = source.Value;

            if (divisor == 0)
            {
                throw new InvalidOperationException("Division by zero.");
            }

            return 10 / divisor;
        });

        var first = ScenarioRunner.Catch(() => _ = quotient.Value);
        var second = ScenarioRunner.Catch(() => _ = quotient.Peek());

        expect.IsTrue(first is InvalidOperationException, "the first read throws");
        expect.IsTrue(first == second, "the second read throws the same instance");
        expect.Equal(1, runs, "compute runs before the fix");

        source.Value = 5;
        Reactivity.Flush();

        expect.Equal(2, quotient.Value, "value after the dependency changed");
        expect.Equal(2, runs, "compute runs after the fix");
    }

    private static void ErroredComputedWithoutDepsRetriesOnTrackedReread(IExpect expect)
    {
        var runs = 0;
        var seen = 0;
        var trigger = Reactivity.Signal(0);

        var flaky = Reactivity.Computed(() =>
        {
            runs++;

            if (runs == 1)
            {
                throw new InvalidOperationException("First run fails.");
            }

            return 42;
        });

        var first = ScenarioRunner.Catch(() => _ = flaky.Value);
        var second = ScenarioRunner.Catch(() => _ = flaky.Value);

        expect.IsTrue(first is not null && first == second, "untracked reads rethrow the error");
        expect.Equal(1, runs, "untracked reads do not retry");

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                return ReadOr(flaky, -1);
            },
            (value, previous) => seen = value
        );

        Reactivity.Flush();

        expect.Equal(-1, seen, "a first tracked read sees the error");
        expect.Equal(1, runs, "a first tracked read does not retry");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal(42, seen, "a tracked re-read after a flush retries");
        expect.Equal(2, runs, "compute runs after the retry");
    }

    /// <summary>
    /// Only the effect that also reads <c>trigger</c> re-reads <c>flaky</c> in a later pass and retries
    /// it; the effect and the computed that read only <c>flaky</c> must still see the recovered value.
    /// </summary>
    private static void RetryThatRecoversUpdatesOtherObservers(IExpect expect)
    {
        var runs = 0;
        var retrying = 0;
        var sibling = 0;
        var trigger = Reactivity.Signal(0);

        var flaky = Reactivity.Computed(() =>
        {
            runs++;

            if (runs == 1)
            {
                throw new InvalidOperationException("First run fails.");
            }

            return 42;
        });

        var derived = Reactivity.Computed(() => ReadOr(flaky, -1) + 1);

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                return ReadOr(flaky, -1);
            },
            (value, previous) => retrying = value
        );

        Reactivity.Effect(() => ReadOr(flaky, -1), (value, previous) => sibling = value);
        Reactivity.Effect(() => derived.Value, (value, previous) => { });
        Reactivity.Flush();

        expect.Equal(-1, sibling, "the sibling effect first sees the error");
        expect.Equal(0, derived.Value, "the computed first sees the error");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal(42, retrying, "the re-reading effect recovered the value");
        expect.Equal(42, sibling, "the sibling effect sees the recovered value");
        expect.Equal(43, derived.Value, "the computed sees the recovered value");
        expect.Equal(2, runs, "the function ran once more");
    }

    /// <summary>
    /// A computed two levels below the reader throws while the dirty check recomputes it: the error
    /// is cached on the way up and reaches the reader, and a later walk over a branching graph is still
    /// correct. Computed catches the error inside the walk, so this does not exercise the defensive
    /// restore of the stack base in DependencyGraph, which no user code reaches.
    /// </summary>
    private static void ErrorInMultiLevelDirtyCheckReachesReader(IExpect expect)
    {
        var source = Reactivity.Signal(0);

        var failing = Reactivity.Computed(() => FailWhenOne(source.Value, "Failing."));

        var next = Reactivity.Computed(() => failing.Value + 1);
        var guarded = Reactivity.Computed(() => ReadOr(next, -1));

        expect.Equal(1, guarded.Value, "value before the error");

        var root = Reactivity.Signal(1);
        var doubled = Reactivity.Computed(() => root.Value * 2);
        var tripled = Reactivity.Computed(() => root.Value * 3);
        var sum = Reactivity.Computed(() => doubled.Value + tripled.Value);

        expect.Equal(5, sum.Value, "branching graph before the error");

        source.Value = 1;
        root.Value = 2;
        Reactivity.Flush();

        expect.Equal(-1, guarded.Value, "the error crossed the multi-level dirty check");
        expect.Equal(10, sum.Value, "a branching graph read afterwards is correct");
    }

    private static void BoundaryReceivesEffectError(IExpect expect)
    {
        var caught = "";
        var source = Reactivity.Signal(0);

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Effect(
                    () => source.Value,
                    (value, previous) =>
                    {
                        if (value == 1)
                        {
                            throw new InvalidOperationException("apply failed");
                        }
                    }
                ),
            error => caught = error.Message
        );

        Reactivity.Flush();
        source.Value = 1;

        var flushError = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(flushError is null, "the flush does not throw");
        expect.Equal("apply failed", caught, "the boundary handler got the error");
    }

    private static void BoundaryReceivesEffectComputeError(IExpect expect)
    {
        var log = "";
        var source = Reactivity.Signal(0);

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Effect(
                    () => FailWhenOne(source.Value + 1, "compute failed") - 1,
                    (value, previous) => log += "apply" + value + ","
                ),
            error => log += error.Message + ","
        );

        Reactivity.Flush();

        expect.Equal("compute failed,", log, "a creation-time compute error reaches the boundary");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(
            "compute failed,apply1,",
            log,
            "the effect recovers when its dependency changes"
        );
    }

    private static void UnhandledEffectErrorEscapesFlush(IExpect expect)
    {
        var thrown = new InvalidOperationException("apply failed");
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                if (value == 1)
                {
                    throw thrown;
                }
            }
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error == thrown, "the flush throws the original exception");
    }

    private static void ThrowingEffectDefersOthersToNextFlush(IExpect expect)
    {
        var thrown = new InvalidOperationException("apply failed");
        var log = "";
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                if (value == 1)
                {
                    throw thrown;
                }
            }
        );

        Reactivity.Effect(() => source.Value, (value, previous) => log += "b" + value + ",");

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error == thrown, "the flush throws at once");
        expect.Equal("b0,", log, "the other effect has not applied yet");

        Reactivity.Flush();

        expect.Equal("b0,b1,", log, "the next flush runs the deferred apply");
    }

    private static void WorkLeftByFailedComputeRunsOnNextFlush(IExpect expect)
    {
        var scheduler = new CountingScheduler();
        var log = "";
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () => FailWhenOne(source.Value, "compute failed"),
            (value, previous) => { }
        );

        Reactivity.Effect(() => source.Value, (value, previous) => log += "b" + value + ",");

        Reactivity.Flush();

        var previousScheduler = Reactivity.Scheduler;

        Reactivity.UseScheduler(scheduler);

        try
        {
            source.Value = 1;

            var error = ScenarioRunner.Catch(Reactivity.Flush);

            expect.IsTrue(error is InvalidOperationException, "the compute error escapes");
            expect.Equal("b0,", log, "the other effect has not run yet");
            expect.Equal(2, scheduler.Requests, "the failed flush requests another one");
        }
        finally
        {
            Reactivity.UseScheduler(previousScheduler);
        }

        Reactivity.Flush();

        expect.Equal("b0,b1,", log, "the next flush runs the queued compute and apply");
    }

    private static void ThrowingSelfWritingEffectStopsAtPassLimit(IExpect expect)
    {
        var scheduler = new RecordingScheduler();
        var log = "";
        var source = Reactivity.Signal(0);
        var other = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                if (value >= 1)
                {
                    source.Value = value + 1;

                    throw new InvalidOperationException("apply failed");
                }
            }
        );

        Reactivity.Effect(() => other.Value, (value, previous) => log += value + ",");

        Reactivity.Flush();

        var previousScheduler = Reactivity.Scheduler;
        var flushes = 0;
        Exception? last = null;

        Reactivity.UseScheduler(scheduler);

        try
        {
            source.Value = 1;

            var flush = scheduler.Take();

            // Bounded so a regression fails the scenario instead of hanging it.
            while (flush is not null && flushes < 1000)
            {
                flushes++;
                last = ScenarioRunner.Catch(flush);
                flush = scheduler.Take();
            }
        }
        finally
        {
            Reactivity.UseScheduler(previousScheduler);
        }

        expect.Equal(101, flushes, "flushes until the pass limit");

        expect.IsTrue(
            last is not null && last.Message == ExpectedMessages.PassLimit,
            "the last flush stops at the pass limit"
        );

        other.Value = 1;
        Reactivity.Flush();

        expect.Equal("0,1,", log, "the graph is usable afterwards");
    }

    private static void EffectThrowingOnEveryChangeNeverHitsPassLimit(IExpect expect)
    {
        var failures = 0;
        var passLimitErrors = 0;
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                if (value != 0)
                {
                    throw new InvalidOperationException("apply failed");
                }
            }
        );

        Reactivity.Flush();

        for (var write = 1; write <= 150; write++)
        {
            source.Value = write;

            var error = ScenarioRunner.Catch(Reactivity.Flush);

            if (error is not null && error.Message == "apply failed")
            {
                failures++;
            }
            else if (error is not null)
            {
                passLimitErrors++;
            }
        }

        expect.Equal(150, failures, "every flush failed with the effect's own error");
        expect.Equal(0, passLimitErrors, "no flush stopped at the pass limit");
        expect.Equal(150, source.Value, "every write was applied");
    }

    /// <summary>
    /// A failed flush requests a resume, but a direct flush runs the leftovers first and spends 60
    /// passes. When the stale resume runs later, it must not carry those passes into the next
    /// 60-pass flush, which would then stop at the 100-pass limit.
    /// </summary>
    private static void StaleResumeSpendsNoPassBudget(IExpect expect)
    {
        var scheduler = new RecordingScheduler();
        var deferred = 0;
        var failures = 0;
        var failing = Reactivity.Signal(0);
        var counter = Reactivity.Signal(0);

        Reactivity.Effect(
            () => failing.Value,
            (value, previous) =>
            {
                if (value == 1)
                {
                    throw new InvalidOperationException("apply failed");
                }
            }
        );

        Reactivity.Effect(() => failing.Value, (value, previous) => deferred = value);
        Reactivity.Effect(() => counter.Value, (value, previous) => CountUpTo(counter, value, 60));
        Reactivity.Flush();

        var previousScheduler = Reactivity.Scheduler;

        Reactivity.UseScheduler(scheduler);

        try
        {
            failing.Value = 1;
            ScenarioRunner.Catch(scheduler.Take()!);
            counter.Value = 1;
            Reactivity.Flush();
            counter.Value = 1;

            var flush = scheduler.Take();

            while (flush is not null)
            {
                if (ScenarioRunner.Catch(flush) is not null)
                {
                    failures++;
                }

                flush = scheduler.Take();
            }
        }
        finally
        {
            Reactivity.UseScheduler(previousScheduler);
        }

        expect.Equal(1, deferred, "the direct flush ran the apply the failed flush left");
        expect.Equal(0, failures, "no flush failed");
        expect.Equal(60, counter.Peek(), "the second count completed");
    }

    /// <summary>Writes the next count while <paramref name="value" /> is between 1 and <paramref name="limit" />.</summary>
    private static void CountUpTo(Signal<int> counter, int value, int limit)
    {
        if (value > 0 && value < limit)
        {
            counter.Value = value + 1;
        }
    }

    private static void ApplyAfterSkippedApplyReceivesLastApplied(IExpect expect)
    {
        var log = "";
        var caught = 0;
        var source = Reactivity.Signal(0);

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Effect(
                    () => source.Value,
                    (value, previous) =>
                    {
                        log += value + ":" + previous + ",";

                        if (value == 0)
                        {
                            Reactivity.OnCleanup(() =>
                                throw new InvalidOperationException("cleanup failed")
                            );
                        }
                    }
                ),
            error => caught++
        );

        Reactivity.Flush();
        source.Value = 1;
        Reactivity.Flush();

        expect.Equal("0:0,", log, "the apply for 1 was skipped by its cleanup error");
        expect.Equal(1, caught, "the boundary got the cleanup error");

        source.Value = 2;
        Reactivity.Flush();

        expect.Equal("0:0,2:0,", log, "the next apply receives the last applied value");
    }

    private static void ThrowingApplyCleanupReachesBoundary(IExpect expect)
    {
        var log = "";
        var caught = "";
        var source = Reactivity.Signal(0);

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Effect(
                    () => source.Value,
                    (value, previous) =>
                    {
                        log += "apply" + value + ",";

                        if (value == 0)
                        {
                            RegisterFailingCleanups(() => log += "second,");
                        }
                    }
                ),
            error => caught = error.Message
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush does not throw");
        expect.Equal("cleanup failed", caught, "the boundary got the cleanup error");
        expect.Equal("apply0,second,", log, "the other cleanup ran and the failed apply did not");
    }

    private static void UnhandledApplyCleanupErrorEscapes(IExpect expect)
    {
        var log = "";
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () => source.Value,
            (value, previous) =>
            {
                log += "apply" + value + ",";

                if (value == 0)
                {
                    RegisterFailingCleanups(() => log += "second,");
                }
            }
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(
            error is not null && error.Message == "cleanup failed",
            "the cleanup error escapes the flush"
        );

        expect.Equal("apply0,second,", log, "the other cleanup ran first");
    }

    private static void SelfDisposingApplyCleanupErrorReachesBoundary(IExpect expect)
    {
        var caught = "";
        var source = Reactivity.Signal(0);

        Reactivity.Root(disposeRoot =>
            Reactivity.ErrorBoundary(
                () =>
                    Reactivity.Effect(
                        () => source.Value,
                        (value, previous) =>
                        {
                            if (value == 0)
                            {
                                Reactivity.OnCleanup(() => DisposeAndFail(disposeRoot));
                            }
                        }
                    ),
                error => caught = error.Message
            )
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush does not throw");
        expect.Equal("disposed and failed", caught, "the boundary got the cleanup error");
    }

    private static void SelfDisposingComputeErrorReachesBoundary(IExpect expect)
    {
        var caught = "";
        var source = Reactivity.Signal(0);

        Reactivity.Root(disposeRoot =>
            Reactivity.ErrorBoundary(
                () =>
                    Reactivity.Effect(
                        () =>
                        {
                            if (source.Value == 1)
                            {
                                DisposeAndFail(disposeRoot);
                            }

                            return 0;
                        },
                        (value, previous) => { }
                    ),
                error => caught = error.Message
            )
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush does not throw");
        expect.Equal("disposed and failed", caught, "the boundary got the compute error");
    }

    private static void DisposeAndFail(Action dispose)
    {
        dispose();

        throw new InvalidOperationException("disposed and failed");
    }

    /// <summary>
    /// Registers <paramref name="other" />, then a cleanup that throws; cleanups run last registered
    /// first, so the throwing one runs before <paramref name="other" />.
    /// </summary>
    private static void RegisterFailingCleanups(Action other)
    {
        Reactivity.OnCleanup(other);
        Reactivity.OnCleanup(() => throw new InvalidOperationException("cleanup failed"));
    }

    private static void ThrowingCleanupDoesNotAbortDisposal(IExpect expect)
    {
        var thrown = new InvalidOperationException("cleanup failed");
        var log = "";
        var caught = "";

        Action dispose = () => { };

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Root(disposeRoot =>
                {
                    dispose = disposeRoot;

                    Reactivity.Effect(
                        () =>
                        {
                            Reactivity.OnCleanup(() => log += "child,");

                            return 0;
                        },
                        (value, previous) => { }
                    );

                    // Cleanups run last registered first, so `thrown` is the first to throw.
                    Reactivity.OnCleanup(() => log += "1,");
                    Reactivity.OnCleanup(() => throw new InvalidOperationException("second"));
                    Reactivity.OnCleanup(() => throw thrown);
                    Reactivity.OnCleanup(() => log += "4,");
                }),
            error => caught = error.Message
        );

        var error = ScenarioRunner.Catch(dispose);

        expect.Equal("child,4,1,", log, "every cleanup and child ran");
        expect.IsTrue(error == thrown, "the disposer rethrows the first error");
        expect.Equal("", caught, "cleanup errors do not go to a boundary");
    }

    private static void ThrowingCleanupInRerunIsRethrownAfterFlush(IExpect expect)
    {
        var log = "";
        var source = Reactivity.Signal(0);

        Reactivity.Effect(
            () =>
            {
                var value = source.Value;

                // Only the first run's cleanup throws, so the final disposal is clean.
                Reactivity.OnCleanup(() =>
                {
                    if (value == 0)
                    {
                        throw new InvalidOperationException("cleanup failed");
                    }
                });

                return value;
            },
            (value, previous) => log += "a" + value + ","
        );

        Reactivity.Flush();
        source.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is InvalidOperationException, "the flush rethrows the cleanup error");
        expect.Equal("a0,a1,", log, "the flush finished before rethrowing");
        expect.IsTrue(ScenarioRunner.Catch(Reactivity.Flush) is null, "the error is rethrown once");
    }

    private static void DisposerInComputedDefersCleanupError(IExpect expect)
    {
        var thrown = new InvalidOperationException("cleanup failed");
        var dispose = RootWithThrowingCleanup(thrown);

        var computed = Reactivity.Computed(() =>
        {
            dispose();

            return 1;
        });

        var readError = ScenarioRunner.Catch(() => _ = computed.Value);
        var flushError = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(readError is null, "the computed does not take the cleanup error");
        expect.Equal(1, computed.Value, "the computed holds its value");
        expect.IsTrue(flushError == thrown, "the next flush rethrows the cleanup error");
    }

    private static void DisposerInEffectComputeKeepsCleanupErrorFromBoundary(IExpect expect)
    {
        var thrown = new InvalidOperationException("cleanup failed");
        var caught = "";
        var dispose = RootWithThrowingCleanup(thrown);

        Reactivity.ErrorBoundary(
            () =>
                Reactivity.Effect(
                    () =>
                    {
                        dispose();

                        return 0;
                    },
                    (value, previous) => { }
                ),
            error => caught = error.Message
        );

        var flushError = ScenarioRunner.Catch(Reactivity.Flush);

        expect.Equal("", caught, "the cleanup error does not go to the boundary");
        expect.IsTrue(flushError == thrown, "the next flush rethrows the cleanup error");
    }

    private static void DisposerInBoundaryBodyKeepsCleanupErrorFromBoundary(IExpect expect)
    {
        var thrown = new InvalidOperationException("cleanup failed");
        var caught = "";
        var dispose = RootWithThrowingCleanup(thrown);

        Reactivity.ErrorBoundary(() => dispose(), error => caught = error.Message);

        var flushError = ScenarioRunner.Catch(Reactivity.Flush);

        expect.Equal("", caught, "the cleanup error does not go to the boundary");
        expect.IsTrue(flushError == thrown, "the next flush rethrows the cleanup error");
    }

    /// <summary>Creates a root whose only cleanup throws <paramref name="thrown" />, and returns its disposer.</summary>
    private static Action RootWithThrowingCleanup(Exception thrown) =>
        Reactivity.Root(disposeRoot =>
        {
            Reactivity.OnCleanup(() => throw thrown);

            return disposeRoot;
        });

    private static void WriteFromCleanupDuringDisposalIsAllowed(IExpect expect)
    {
        var source = Reactivity.Signal(0);
        var other = Reactivity.Signal(0);
        var written = Reactivity.Signal(-1);

        var inner = Reactivity.Computed(() =>
        {
            var value = source.Value;

            Reactivity.OnCleanup(() => written.Value = value);

            return value;
        });

        // Reads `other` first, so `outer` is dirty and reruns, and `inner` reruns inside it: the
        // cleanup of `inner` runs while `outer` is the current owner.
        var outer = Reactivity.Computed(() => other.Value + inner.Value);

        expect.Equal(0, outer.Value, "initial value");

        source.Value = 1;
        other.Value = 1;
        Reactivity.Flush();

        var error = ScenarioRunner.Catch(() => _ = outer.Value);

        Reactivity.Flush();

        expect.IsTrue(error is null, "the write from the cleanup does not throw");
        expect.Equal(2, outer.Value, "value after the rerun");
        expect.Equal(0, written.Value, "the cleanup write committed");
    }

    private static void SelfDisposingComputedKeepsNoDependency(IExpect expect)
    {
        var runs = 0;
        var source = Reactivity.Signal(0);
        var late = Reactivity.Signal(0);

        Action dispose = () => { };

        var computed = Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;

            return Reactivity.Computed(() =>
            {
                runs++;

                var value = source.Value;

                if (value == 1)
                {
                    dispose();
                }

                return value + late.Value;
            });
        });

        expect.Equal(0, computed.Value, "initial value");

        source.Value = 1;
        Reactivity.Flush();

        expect.Equal(1, computed.Value, "value of the run that disposed it");

        late.Value = 5;
        Reactivity.Flush();

        expect.Equal(1, computed.Value, "a disposed computed keeps its last value");
        expect.Equal(2, runs, "the dependency read after disposal does not rerun it");
    }

    private static void RunnerKeepsScenarioErrorAndDrainsLeftovers(IExpect expect)
    {
        var thrown = new InvalidOperationException("scenario failed");
        var signal = Reactivity.Signal(0);

        var inner = new Scenario("inner", _ =>
        {
            Reactivity.OnCleanup(() => throw new InvalidOperationException("cleanup failed"));
            signal.Value = 1;

            throw thrown;
        });

        var error = ScenarioRunner.Catch(() => ScenarioRunner.Run(inner, expect));

        expect.IsTrue(error == thrown, "the scenario error is not masked by the cleanup error");
        expect.Equal(1, signal.Peek(), "the leftover write was drained");
        expect.IsTrue(ScenarioRunner.Catch(Reactivity.Flush) is null, "no error is left behind");
    }

    private static int FailWhenOne(int value, string message)
    {
        if (value == 1)
        {
            throw new InvalidOperationException(message);
        }

        return value;
    }

    private static T ReadOr<T>(Computed<T> computed, T fallback)
    {
        try
        {
            return computed.Value;
        }
        catch (InvalidOperationException)
        {
            return fallback;
        }
    }

    /// <summary>
    /// Keeps every flush requested, in request order, so a scenario can run them like an event loop
    /// would.
    /// </summary>
    private sealed class RecordingScheduler : IFlushScheduler
    {
        private RequestedFlush? _first;
        private RequestedFlush? _last;

        public void Schedule(Action flush)
        {
            var requested = new RequestedFlush(flush);

            if (_last is null)
            {
                _first = requested;
            }
            else
            {
                _last.Next = requested;
            }

            _last = requested;
        }

        /// <summary>Removes and returns the oldest flush requested, or null when none is left.</summary>
        public Action? Take()
        {
            var first = _first;

            if (first is null)
            {
                return null;
            }

            _first = first.Next;

            if (_first is null)
            {
                _last = null;
            }

            return first.Flush;
        }

        private sealed class RequestedFlush(Action flush)
        {
            public Action Flush { get; } = flush;

            public RequestedFlush? Next { get; set; }
        }
    }
}
