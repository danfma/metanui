using Metanui.Reactive;
using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios.Components;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for components: props, content and the props lambda's rules.</summary>
public static class ComponentScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "signal-backed prop takes a static value or a split bind",
            SignalBackedPropTakesAStaticValueOrASplitBind
        ),
        new Scenario("plain prop is init-only: a split bind to it is lost", PlainPropIsInitOnly),
        new Scenario(
            "content lands inside the component's element",
            ContentLandsInsideTheComponentsElement
        ),
        new Scenario(
            "content of a component without an element lands between its siblings",
            ContentOfAComponentWithoutAnElementLandsBetweenItsSiblings
        ),
        new Scenario(
            "an element created in the props lambda throws",
            AnElementCreatedInThePropsLambdaThrows
        ),
        new Scenario(
            "a signal-backed prop assigned inside a For item throws",
            ASignalBackedPropAssignedInsideAForItemThrows
        ),
    ];

    private static void SignalBackedPropTakesAStaticValueOrASplitBind(IExpect expect)
    {
        var host = new FakeHost();
        var name = Reactivity.Signal("Ada");

        host.Render(() =>
        {
            Card.Create(card => card.Title = "Static");
            Card.Create(card => Bind(() => name.Value, value => card.Title = value));
        });

        Reactivity.Flush();

        expect.Equal(
            "box\"card\"(label\"Static\") box\"card\"(label\"Ada\")",
            host.Print(),
            "after the first flush"
        );

        name.Value = "Grace";
        Reactivity.Flush();

        expect.Equal(
            "box\"card\"(label\"Static\") box\"card\"(label\"Grace\")",
            host.Print(),
            "after the change"
        );
    }

    /// <summary>
    /// Documented v1 behaviour (spike: <c>Count: 1 (Start = 106)</c>): Render reads a plain prop
    /// once, before the split bind's first apply, so the bound value never shows.
    /// </summary>
    private static void PlainPropIsInitOnly(IExpect expect)
    {
        var host = new FakeHost();
        var start = Reactivity.Signal(5);

        host.Render(() =>
        {
            Counter.Create(counter => counter.Start = 7);
            Counter.Create(counter => Bind(() => start.Value, value => counter.Start = value));
        });

        Reactivity.Flush();

        expect.Equal("label\"start=7\" label\"start=0\"", host.Print(), "the bound value is lost");
    }

    private static void ContentLandsInsideTheComponentsElement(IExpect expect)
    {
        var host = new FakeHost();

        host.Render(() =>
            Card.Create(card =>
            {
                card.Title = "T";

                card.Content = () =>
                {
                    Label("one");
                    Label("two");
                };
            })
        );

        Reactivity.Flush();

        expect.Equal("box\"card\"(label\"T\" label\"one\" label\"two\")", host.Print(), "tree");
    }

    private static void ContentOfAComponentWithoutAnElementLandsBetweenItsSiblings(IExpect expect)
    {
        var host = new FakeHost();

        host.Render(() =>
        {
            Label("first");
            Frame.Create(frame => frame.Content = () => Label("inside"));
            Label("last");
        });

        expect.Equal(
            "label\"first\" label\"before\" label\"inside\" label\"after\" label\"last\"",
            host.Print(),
            "no wrapper element"
        );

        expect.Equal(5, host.Container.ChildCount, "no extra node");
    }

    private static void AnElementCreatedInThePropsLambdaThrows(IExpect expect)
    {
        var host = new FakeHost();
        Exception? error = null;

        host.Render(() =>
        {
            error = ScenarioRunner.Catch(() => Card.Create(card => Label("child")));
            Label("next");
        });

        expect.Equal(ExpectedUiMessages.ChildrenGoInContent, error?.Message, "error");
        expect.Equal("label\"next\"", host.Print(), "the scope is restored");
    }

    /// <summary>
    /// Documented v1 limitation: a For item renders inside a computation, where a signal write
    /// throws (spec 0001), so a signal-backed prop must be bound there, not assigned.
    /// </summary>
    private static void ASignalBackedPropAssignedInsideAForItemThrows(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);

        var error = ScenarioRunner.Catch(() =>
            host.Render(() =>
                For(() => items.Value, item => Card.Create(card => card.Title = item))
            )
        );

        expect.Equal(ExpectedUiMessages.SignalWriteInComputation, error?.Message, "error");
    }
}
