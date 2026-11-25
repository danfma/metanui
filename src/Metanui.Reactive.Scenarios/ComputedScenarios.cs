namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for <see cref="Computed{T}" />.</summary>
public static class ComputedScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario("computed is lazy", IsLazy),
        new Scenario("computed is cached", IsCached),
        new Scenario("computed recomputes after flush", RecomputesAfterFlush),
        new Scenario("diamond is glitch-free", DiamondIsGlitchFree),
        new Scenario("equal result stops propagation", EqualResultStopsPropagation),
        new Scenario("dynamic dependency is dropped", DynamicDependencyIsDropped),
        new Scenario("write inside compute throws", WriteInsideComputeThrows),
        new Scenario("nested dirty check walks branching dependencies", NestedDirtyCheck),
    ];

    private static void IsLazy(IExpect expect)
    {
        var runs = 0;

        var computed = Reactivity.Computed(() =>
        {
            runs++;

            return 1;
        });

        expect.Equal(0, runs, "runs before the first read");
        expect.Equal(1, computed.Value, "first read");
        expect.Equal(1, runs, "runs after the first read");
    }

    private static void IsCached(IExpect expect)
    {
        var runs = 0;
        var count = Reactivity.Signal(3);

        var doubled = Reactivity.Computed(() =>
        {
            runs++;

            return count.Value * 2;
        });

        expect.Equal(6, doubled.Value, "first read");
        expect.Equal(6, doubled.Value, "second read");
        expect.Equal(1, runs, "runs after two reads");
    }

    private static void RecomputesAfterFlush(IExpect expect)
    {
        var runs = 0;
        var count = Reactivity.Signal(1);

        var doubled = Reactivity.Computed(() =>
        {
            runs++;

            return count.Value * 2;
        });

        expect.Equal(2, doubled.Value, "initial value");

        count.Value = 5;
        Reactivity.Flush();

        expect.Equal(10, doubled.Value, "value after flush");
        expect.Equal(2, runs, "runs after flush");
    }

    private static void DiamondIsGlitchFree(IExpect expect)
    {
        var seen = new List<int>();
        var a = Reactivity.Signal(0);
        var b = Reactivity.Computed(() => a.Value + 1);
        var c = Reactivity.Computed(() => a.Value * 2);

        var d = Reactivity.Computed(() =>
        {
            var sum = b.Value + c.Value;

            seen.Add(sum);

            return sum;
        });

        expect.Equal(1, d.Value, "initial value");

        a.Value = 2;
        Reactivity.Flush();

        expect.Equal(7, d.Value, "value after flush");
        expect.Equal(2, seen.Count, "values seen by d");
        expect.Equal(1, seen[0], "first value seen by d");
        expect.Equal(7, seen[1], "second value seen by d");
    }

    private static void EqualResultStopsPropagation(IExpect expect)
    {
        var downstreamRuns = 0;
        var count = Reactivity.Signal(0);
        var parity = Reactivity.Computed(() => count.Value % 2);

        var downstream = Reactivity.Computed(() =>
        {
            downstreamRuns++;

            return parity.Value * 10;
        });

        expect.Equal(0, downstream.Value, "initial value");

        count.Value = 2;
        Reactivity.Flush();

        expect.Equal(0, downstream.Value, "value after an equal parity");
        expect.Equal(1, downstreamRuns, "downstream runs");
    }

    private static void DynamicDependencyIsDropped(IExpect expect)
    {
        var runs = 0;
        var flag = Reactivity.Signal(true);
        var a = Reactivity.Signal(1);
        var b = Reactivity.Signal(2);

        var pick = Reactivity.Computed(() =>
        {
            runs++;

            return flag.Value ? a.Value : b.Value;
        });

        expect.Equal(1, pick.Value, "picks a");

        flag.Value = false;
        Reactivity.Flush();

        expect.Equal(2, pick.Value, "picks b");
        expect.Equal(2, runs, "runs after switching to b");

        a.Value = 10;
        Reactivity.Flush();

        expect.Equal(2, pick.Value, "still picks b");
        expect.Equal(2, runs, "runs after writing the dropped dependency");
    }

    private static void WriteInsideComputeThrows(IExpect expect)
    {
        var target = Reactivity.Signal(0);

        var writer = Reactivity.Computed(() =>
        {
            target.Value = 1;

            return 0;
        });

        // Metano #773: a discard assignment `_ = expr` is emitted as an assignment to an undeclared `_`
        var error = ScenarioRunner.Catch(() =>
        {
            var value = writer.Value;
        });

        expect.IsTrue(error is InvalidOperationException, "reading a writing computed throws");
    }

    // Reading `top` walks top -> middle -> inner (pending) and recomputes the dirty `inner` while that
    // walk is one frame deep; `inner` reads the pending `outer`, whose own walk descends into `sum`
    // because `sum` is Mutable|Pending, so the nested walk pushes above the first one.
    private static void NestedDirtyCheck(IExpect expect)
    {
        var source = Reactivity.Signal(1);
        var plusOne = Reactivity.Computed(() => source.Value + 1);
        var twice = Reactivity.Computed(() => source.Value * 2);
        var sum = Reactivity.Computed(() => plusOne.Value + twice.Value);
        var outer = Reactivity.Computed(() => sum.Value);
        var inner = Reactivity.Computed(() => source.Value + outer.Value);
        var middle = Reactivity.Computed(() => inner.Value);
        var top = Reactivity.Computed(() => middle.Value + 1);

        expect.Equal(6, top.Value, "initial value");

        source.Value = 2;
        Reactivity.Flush();

        expect.Equal(10, top.Value, "value after flush");
        expect.Equal(7, outer.Value, "outer after flush");
    }
}
