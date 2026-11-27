using Metanui.Reactive;
using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for <see cref="View.Render" /> and its disposal.</summary>
public static class RenderScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "disposing the render removes every node and stops the tree",
            DisposingTheRenderRemovesEveryNodeAndStopsTheTree
        ),
        new Scenario(
            "a render that throws leaves no node behind",
            ARenderThatThrowsLeavesNoNodeBehind
        ),
    ];

    private static void DisposingTheRenderRemovesEveryNodeAndStopsTheTree(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(0);
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);
        var writes = 0;
        var cleanups = 0;

        var view = host.Render(() =>
        {
            Reactivity.OnCleanup(() => cleanups++);

            Box(box =>
                Bind(() =>
                {
                    writes++;
                    box.Text = $"{count.Value}";
                })
            );

            Text("text");
            For(() => items.Value, item => Label(item));
            Show(() => count.Value >= 0, () => Label("shown"));
        });

        view.Dispose();
        count.Value = 1;
        Reactivity.Flush();

        expect.Equal(0, host.Container.ChildCount, "no node left, anchors included");
        expect.Equal(1, cleanups, "the tree is disposed");
        expect.Equal(1, writes, "no binding runs after the disposal");
    }

    private static void ARenderThatThrowsLeavesNoNodeBehind(IExpect expect)
    {
        var host = new FakeHost();

        var error = ScenarioRunner.Catch(() =>
            host.Render(() =>
            {
                Label("a");
                throw new InvalidOperationException("boom");
            })
        );

        expect.Equal("boom", error?.Message, "error");
        expect.Equal(0, host.Container.ChildCount, "no node left");
    }
}
