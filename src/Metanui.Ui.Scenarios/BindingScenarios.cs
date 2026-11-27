using Metanui.Reactive;
using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for the fused and split bindings and for dynamic text.</summary>
public static class BindingScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "fused bind writes now and on every change",
            FusedBindWritesNowAndOnEveryChange
        ),
        new Scenario(
            "split bind writes in the apply and skips equal values",
            SplitBindWritesInTheApplyAndSkipsEqualValues
        ),
        new Scenario("a signal write in a fused bind throws", ASignalWriteInAFusedBindThrows),
        new Scenario("dynamic text follows its source", DynamicTextFollowsItsSource),
        new Scenario("disposing a bind stops its writes", DisposingABindStopsItsWrites),
    ];

    private static void FusedBindWritesNowAndOnEveryChange(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(0);

        host.Render(() => Label(label => Bind(() => label.Text = $"n={count.Value}")));

        expect.Equal("label\"n=0\"", host.Print(), "written at once, before any flush");

        count.Value = 1;
        Reactivity.Flush();

        expect.Equal("label\"n=1\"", host.Print(), "after the change");
    }

    private static void SplitBindWritesInTheApplyAndSkipsEqualValues(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(0);
        var writes = 0;

        host.Render(() =>
            Label(label =>
                Bind(
                    () => count.Value >= 0 ? "non-negative" : "negative",
                    sign =>
                    {
                        writes++;
                        label.Text = sign;
                    }
                )
            )
        );

        expect.Equal("label", host.Print(), "nothing written before the flush");

        Reactivity.Flush();

        expect.Equal("label\"non-negative\"", host.Print(), "first apply");

        count.Value = 2;
        Reactivity.Flush();

        expect.Equal(1, writes, "an equal value is not written again");

        count.Value = -1;
        Reactivity.Flush();

        expect.Equal("label\"negative\"", host.Print(), "a different value is written");
        expect.Equal(2, writes, "writes");
    }

    private static void ASignalWriteInAFusedBindThrows(IExpect expect)
    {
        var target = Reactivity.Signal(0);
        var error = ScenarioRunner.Catch(() => Bind(() => target.Value = 1));

        expect.Equal(ExpectedUiMessages.SignalWriteInComputation, error?.Message, "error");
    }

    private static void DynamicTextFollowsItsSource(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(0);

        host.Render(() => Box(box => Text(() => $"c={count.Value}")));

        expect.Equal("box('c=0')", host.Print(), "initial");

        count.Value = 1;
        Reactivity.Flush();

        expect.Equal("box('c=1')", host.Print(), "after the change");
    }

    private static void DisposingABindStopsItsWrites(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(0);
        IDisposable? binding = null;

        host.Render(() => Label(label => binding = Bind(() => label.Text = $"n={count.Value}")));
        binding?.Dispose();
        count.Value = 1;
        Reactivity.Flush();

        expect.Equal("label\"n=0\"", host.Print(), "unchanged after the disposal");
    }
}
