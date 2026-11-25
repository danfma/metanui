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
            "retry that recovers an errored computed updates an already pending sibling effect",
            RetryRecoveryUpdatesAPendingSibling
        ),
        new Scenario(
            "retry that recovers an errored computed updates an already pending sibling computed",
            RetryRecoveryUpdatesAPendingSiblingComputed
        ),
        new Scenario(
            "retry that recovers an errored computed reaches an effect through a pending computed",
            RetryRecoveryReachesAnEffectThroughAPendingComputed
        ),
        new Scenario(
            "retry that fails again does not retry on every pass",
            RetryThatFailsAgainDoesNotRetryOnEveryPass
        ),
        new Scenario(
            "retry never shows an observer a mix of the recovered and the old value",
            RetryNeverShowsAMixOfRecoveredAndOldValue
        ),
        new Scenario(
            "retry that fails again gives an already pending sibling the new error",
            RetryThatFailsAgainReachesAPendingSibling
        ),
        new Scenario(
            "errored computed re-read by several observers is retried once",
            ErroredComputedReReadBySeveralObserversIsRetriedOnce
        ),
        new Scenario(
            "computed disposed while its retry is pending is not retried",
            ComputedDisposedWhileItsRetryIsPendingIsNotRetried
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
    /// Only the effect that also reads <c>trigger</c> re-reads <c>flaky</c> in a later pass and asks
    /// for the retry; the effect and the computed that read only <c>flaky</c> must still see the
    /// recovered value.
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
    /// The effect reads <c>flaky</c> before <c>C</c>, so a trigger change leaves it pending through
    /// <c>C</c>. Its dirty check recomputes <c>C</c>, whose tracked re-read asks for a retry of
    /// <c>flaky</c> after the effect's check already passed it. A retry that ran there turned the
    /// effect dirty in the middle of the check, which then re-armed it and dropped the change.
    /// </summary>
    private static void RetryRecoveryUpdatesAPendingSibling(IExpect expect)
    {
        var seen = 0;
        var trigger = Reactivity.Signal(0);
        var flaky = FailingOnFirstRun(42);

        var c = Reactivity.Computed(() =>
        {
            _ = trigger.Value;
            ReadOr(flaky, -1);

            return 0;
        });

        Reactivity.Effect(
            () =>
            {
                var f = ReadOr(flaky, -1);
                _ = c.Value;

                return f;
            },
            (value, previous) => seen = value
        );

        Reactivity.Flush();

        expect.Equal(-1, seen, "the effect first sees the error");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal(42, seen, "the effect sees the recovered value");
    }

    /// <summary>
    /// The computed variant of <see cref="RetryRecoveryUpdatesAPendingSibling" />: <c>D</c> reads
    /// <c>flaky</c> before <c>C</c>, has no subscriber, and is refreshed by an untracked read while
    /// pending. The retry happens outside a flush, so the flush it requests carries the change to D.
    /// </summary>
    private static void RetryRecoveryUpdatesAPendingSiblingComputed(IExpect expect)
    {
        var trigger = Reactivity.Signal(0);
        var flaky = FailingOnFirstRun(42);

        var c = Reactivity.Computed(() =>
        {
            _ = trigger.Value;
            ReadOr(flaky, -1);

            return 0;
        });

        var d = Reactivity.Computed(() =>
        {
            var f = ReadOr(flaky, -1);
            _ = c.Value;

            return f;
        });

        expect.Equal(-1, d.Peek(), "the computed first sees the error");

        // The commit leaves C and D pending, in a later pass than the failure.
        trigger.Value = 1;
        Reactivity.Flush();

        // Refreshing D recomputes C, whose tracked re-read retries flaky; D gets the change in the
        // next pass, like a signal write.
        _ = d.Peek();
        Reactivity.Flush();

        expect.Equal(42, d.Peek(), "the computed sees the recovered value after the next pass");
    }

    /// <summary>
    /// <see cref="RetryRecoveryUpdatesAPendingSiblingComputed" /> observed by an effect: the retry is
    /// requested inside the effect's dirty check, one level below the effect. A retry that ran there
    /// left <c>D</c> dirty with its subscriber never notified.
    /// </summary>
    private static void RetryRecoveryReachesAnEffectThroughAPendingComputed(IExpect expect)
    {
        var seen = 0;
        var trigger = Reactivity.Signal(0);
        var flaky = FailingOnFirstRun(42);

        var c = Reactivity.Computed(() =>
        {
            _ = trigger.Value;
            ReadOr(flaky, -1);

            return 0;
        });

        var d = Reactivity.Computed(() =>
        {
            var f = ReadOr(flaky, -1);
            _ = c.Value;

            return f;
        });

        Reactivity.Effect(() => d.Value, (value, previous) => seen = value);
        Reactivity.Flush();

        expect.Equal(-1, seen, "the effect first sees the error");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal(42, seen, "the effect sees the recovered value");
    }

    /// <summary>
    /// A computed that always fails, re-read by an effect after a flush: the retry fails again in the
    /// next pass, and that error, cached in the pass that reruns the effect, must not make the effect
    /// request another retry on every pass.
    /// </summary>
    private static void RetryThatFailsAgainDoesNotRetryOnEveryPass(IExpect expect)
    {
        var runs = 0;
        var seen = 0;
        var trigger = Reactivity.Signal(0);

        var broken = Reactivity.Computed<int>(() =>
        {
            runs++;

            throw new InvalidOperationException("Always fails.");
        });

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                return ReadOr(broken, -1);
            },
            (value, previous) => seen = value
        );

        Reactivity.Flush();
        trigger.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush completes");
        expect.Equal(-1, seen, "the effect sees the error");
        expect.Equal(2, runs, "the function ran once more");
    }

    /// <summary>
    /// The effect reads <c>flaky</c> directly and through <c>x</c>. Every apply must pair values from
    /// the same state: both from the error, or both from the recovered value. A retry that ran during
    /// the read gave the effect the recovered <c>flaky</c> next to the old <c>x</c>.
    /// </summary>
    private static void RetryNeverShowsAMixOfRecoveredAndOldValue(IExpect expect)
    {
        var log = "";
        var trigger = Reactivity.Signal(0);
        var flaky = FailingOnFirstRun(42);
        var x = Reactivity.Computed(() => ReadOr(flaky, -1) + 1);

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                var f = ReadOr(flaky, -1);

                return $"{f},{x.Value}";
            },
            (value, previous) => log = log + "|" + value
        );

        Reactivity.Flush();
        trigger.Value = 1;
        Reactivity.Flush();

        // The trigger pass re-reads the cached error everywhere; the retry pass that follows sees the
        // recovered value everywhere.
        expect.Equal("|-1,0|-1,0|42,43", log, "applies");
    }

    /// <summary>
    /// The shape of <see cref="RetryRecoveryUpdatesAPendingSibling" /> with a computed that fails on
    /// every run: the effect must end on the retry's new error, not keep the first one.
    /// </summary>
    private static void RetryThatFailsAgainReachesAPendingSibling(IExpect expect)
    {
        var runs = 0;
        var seen = "";
        var trigger = Reactivity.Signal(0);

        var flaky = Reactivity.Computed<int>(() =>
        {
            runs++;

            throw new InvalidOperationException($"e{runs}");
        });

        var c = Reactivity.Computed(() =>
        {
            _ = trigger.Value;
            ReadOr(flaky, -1);

            return 0;
        });

        Reactivity.Effect(
            () =>
            {
                var message = ScenarioRunner.Catch(() => _ = flaky.Value)?.Message ?? "";
                _ = c.Value;

                return message;
            },
            (value, previous) => seen = value
        );

        Reactivity.Flush();

        expect.Equal("e1", seen, "the effect first sees the first error");

        trigger.Value = 1;
        Reactivity.Flush();

        expect.Equal("e2", seen, "the effect sees the retry's error");
        expect.Equal(2, runs, "the function ran once more");
    }

    /// <summary>
    /// Two effects re-read two errored computeds in one pass, so each computed is queued for a retry
    /// twice: the second request must neither queue it again nor run it twice.
    /// </summary>
    private static void ErroredComputedReReadBySeveralObserversIsRetriedOnce(IExpect expect)
    {
        var firstRuns = 0;
        var secondRuns = 0;
        var seen = "";
        var trigger = Reactivity.Signal(0);

        var first = Reactivity.Computed(() =>
        {
            firstRuns++;

            return firstRuns == 1 ? throw new InvalidOperationException("First run fails.") : 1;
        });

        var second = Reactivity.Computed(() =>
        {
            secondRuns++;

            return secondRuns == 1 ? throw new InvalidOperationException("First run fails.") : 2;
        });

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                return ReadOr(first, -1) + ReadOr(second, -1);
            },
            (value, previous) => { }
        );

        Reactivity.Effect(
            () =>
            {
                _ = trigger.Value;

                return $"{ReadOr(second, -1)},{ReadOr(first, -1)}";
            },
            (value, previous) => seen = value
        );

        Reactivity.Flush();
        trigger.Value = 1;

        var error = ScenarioRunner.Catch(Reactivity.Flush);

        expect.IsTrue(error is null, "the flush completes");
        expect.Equal("2,1", seen, "the second effect sees both recovered values");
        expect.Equal(2, firstRuns, "the first computed ran once more");
        expect.Equal(2, secondRuns, "the second computed ran once more");
    }

    /// <summary>
    /// A retry is queued outside a flush, then the computed is disposed before the flush: the flush
    /// skips it, and the computed keeps its frozen error instead of running a released function.
    /// </summary>
    private static void ComputedDisposedWhileItsRetryIsPendingIsNotRetried(IExpect expect)
    {
        var trigger = Reactivity.Signal(0);

        var graph = Reactivity.Root(dispose =>
        {
            var flaky = FailingOnFirstRun(42);

            var reader = Reactivity.Computed(() =>
            {
                _ = trigger.Value;

                return ReadOr(flaky, -1);
            });

            return new OwnedRetryGraph(flaky, reader, dispose);
        });

        expect.Equal(-1, graph.Reader.Peek(), "the reader first sees the error");

        // The commit leaves the reader pending in a later pass than the failure; refreshing it
        // re-reads flaky and queues the retry.
        trigger.Value = 1;
        Reactivity.Flush();
        _ = graph.Reader.Peek();
        graph.Dispose();

        var flushError = ScenarioRunner.Catch(Reactivity.Flush);
        var readError = ScenarioRunner.Catch(() => _ = graph.Flaky.Peek());

        // A retried run would return 42, or fail on the function the disposal released.
        expect.IsTrue(flushError is null, "the flush completes");
        expect.IsTrue(
            readError is InvalidOperationException { Message: "First run fails." },
            "the disposed computed keeps its error"
        );
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

    /// <summary>A computed with no dependency that throws on its first run and returns <paramref name="value" /> after.</summary>
    private static Computed<int> FailingOnFirstRun(int value)
    {
        var runs = 0;

        return Reactivity.Computed(() =>
        {
            runs++;

            if (runs == 1)
            {
                throw new InvalidOperationException("First run fails.");
            }

            return value;
        });
    }

    /// <summary>An errored computed, a computed that reads it, and the disposer of the root that owns both.</summary>
    private sealed record OwnedRetryGraph(
        Computed<int> Flaky,
        Computed<int> Reader,
        Action Dispose
    );

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
