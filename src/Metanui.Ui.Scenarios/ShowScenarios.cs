using Metanui.Reactive;
using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for <c>Show</c>: one branch at a time, disposed when hidden.</summary>
public static class ShowScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "show renders the active branch and disposes the hidden one",
            ShowRendersTheActiveBranchAndDisposesTheHiddenOne
        ),
        new Scenario(
            "show keeps its branch while the condition result is unchanged",
            ShowKeepsItsBranchWhileTheConditionResultIsUnchanged
        ),
        new Scenario(
            "show without otherwise renders nothing when false",
            ShowWithoutOtherwiseRendersNothingWhenFalse
        ),
        new Scenario(
            "a branch that throws inside a boundary moves and hides with its region",
            ABranchThatThrowsInsideABoundaryMovesAndHidesWithItsRegion
        ),
    ];

    private static void ShowRendersTheActiveBranchAndDisposesTheHiddenOne(IExpect expect)
    {
        var host = new FakeHost();
        var on = Reactivity.Signal(true);
        var count = Reactivity.Signal(0);
        var disposals = 0;

        host.Render(() =>
        {
            Label("before");

            Show(
                () => on.Value,
                () =>
                {
                    Reactivity.OnCleanup(() => disposals++);
                    Label(label => Bind(() => label.Text = $"on {count.Value}"));
                },
                () => Label("off")
            );

            Label("after");
        });

        expect.Equal("label\"before\" label\"on 0\" label\"after\"", host.Print(), "on");

        on.Value = false;
        Reactivity.Flush();

        expect.Equal("label\"before\" label\"off\" label\"after\"", host.Print(), "off");
        expect.Equal(1, disposals, "the hidden branch is disposed");

        count.Value = 1;
        on.Value = true;
        Reactivity.Flush();

        expect.Equal("label\"before\" label\"on 1\" label\"after\"", host.Print(), "on again");
        expect.Equal(4, host.Container.ChildCount, "three labels and the end anchor");
    }

    private static void ShowKeepsItsBranchWhileTheConditionResultIsUnchanged(IExpect expect)
    {
        var host = new FakeHost();
        var count = Reactivity.Signal(1);
        var renders = 0;

        host.Render(() =>
            Show(
                () => count.Value > 0,
                () =>
                {
                    renders++;
                    Label("positive");
                }
            )
        );

        count.Value = 2;
        Reactivity.Flush();

        expect.Equal(1, renders, "an unchanged condition keeps the branch");
    }

    /// <summary>
    /// The branch of item <c>a</c> throws after inserting a node: the node stays tracked by the
    /// region, so it moves with the item and is removed when the branch is hidden.
    /// </summary>
    private static void ABranchThatThrowsInsideABoundaryMovesAndHidesWithItsRegion(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);
        var on = Reactivity.Signal(false);
        var errors = new List<string>();

        Reactivity.ErrorBoundary(
            () =>
                host.Render(() =>
                    For(
                        () => items.Value,
                        item =>
                        {
                            Label(item);
                            Show(() => on.Value, () => ShowMarked(item));
                        }
                    )
                ),
            error => errors.Add(error.Message)
        );

        on.Value = true;
        Reactivity.Flush();

        expect.Equal("boom", string.Join(",", errors), "routed to the boundary");

        items.Value = ["b", "a"];
        Reactivity.Flush();

        expect.Equal(
            "label\"b\" label\"b!\" label\"a\" label\"a!\"",
            host.Print(),
            "the partial branch moved with its item"
        );

        on.Value = false;
        Reactivity.Flush();

        expect.Equal("label\"b\" label\"a\"", host.Print(), "both branches hidden");
    }

    private static void ShowMarked(string item)
    {
        Label($"{item}!");

        if (item == "a")
        {
            throw new InvalidOperationException("boom");
        }
    }

    private static void ShowWithoutOtherwiseRendersNothingWhenFalse(IExpect expect)
    {
        var host = new FakeHost();
        var on = Reactivity.Signal(false);

        host.Render(() => Show(() => on.Value, () => Label("on")));

        expect.Equal("", host.Print(), "off");

        on.Value = true;
        Reactivity.Flush();

        expect.Equal("label\"on\"", host.Print(), "on");
    }
}
