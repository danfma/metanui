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
            "a prop takes a static value or a live reader",
            APropTakesAStaticValueOrALiveReader
        ),
        new Scenario("a bind in the props lambda throws", ABindInThePropsLambdaThrows),
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
            "a prop assigned inside a For item and a Show branch works",
            APropAssignedInsideAForItemAndAShowBranchWorks
        ),
        new Scenario(
            "a live prop in a Show branch is bound again when the branch comes back",
            ALivePropInAShowBranchIsBoundAgainWhenTheBranchComesBack
        ),
    ];

    /// <summary>
    /// A static prop reaches <c>Render</c> at once, with no flush; a live prop is read by the
    /// binding in <c>Render</c>, so it follows its source.
    /// </summary>
    private static void APropTakesAStaticValueOrALiveReader(IExpect expect)
    {
        var host = new FakeHost();
        var name = Reactivity.Signal("Ada");

        host.Render(() =>
        {
            Card.Create(card => card.Title = "Static");
            Card.Create(card => card.Title = Live(() => name.Value));
        });

        expect.Equal(
            "box\"card\"(label\"Static\") box\"card\"(label\"Ada\")",
            host.Print(),
            "before any flush"
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
    /// <c>Render</c> reads the props once, right after the props lambda, so a binding there would be
    /// lost silently, whether it targets a <see cref="Prop{T}" /> or a plain property; it throws.
    /// </summary>
    private static void ABindInThePropsLambdaThrows(IExpect expect)
    {
        var host = new FakeHost();
        var name = Reactivity.Signal("Ada");
        var start = Reactivity.Signal(5);
        Exception? propError = null;
        Exception? plainError = null;

        host.Render(() =>
        {
            propError = ScenarioRunner.Catch(() =>
                Card.Create(card => Bind(() => card.Title = name.Value))
            );

            plainError = ScenarioRunner.Catch(() =>
                Counter.Create(counter => Bind(() => start.Value, value => counter.Start = value))
            );

            Label("next");
        });

        expect.Equal(ExpectedUiMessages.BindingInPropsLambda, propError?.Message, "prop");
        expect.Equal(
            ExpectedUiMessages.BindingInPropsLambda,
            plainError?.Message,
            "plain property"
        );
        expect.Equal("label\"next\"", host.Print(), "the scope is restored");
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
    /// A <c>For</c> item and a <c>Show</c> branch render inside a computation, where a signal write
    /// throws (spec 0001); assigning a <see cref="Prop{T}" /> writes no signal, so it works there,
    /// static or live.
    /// </summary>
    private static void APropAssignedInsideAForItemAndAShowBranchWorks(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);
        var suffix = Reactivity.Signal("!");

        host.Render(() =>
        {
            For(
                () => items.Value,
                item =>
                {
                    Card.Create(card => card.Title = item);
                    Card.Create(card => card.Title = Live(() => item + suffix.Value));
                }
            );

            Show(
                () => true,
                () =>
                {
                    Card.Create(card => card.Title = "shown");
                    Card.Create(card => card.Title = Live(() => "shown" + suffix.Value));
                }
            );
        });

        expect.Equal(
            "box\"card\"(label\"a\") box\"card\"(label\"a!\") "
                + "box\"card\"(label\"shown\") box\"card\"(label\"shown!\")",
            host.Print(),
            "initial"
        );

        suffix.Value = "?";
        Reactivity.Flush();

        expect.Equal(
            "box\"card\"(label\"a\") box\"card\"(label\"a?\") "
                + "box\"card\"(label\"shown\") box\"card\"(label\"shown?\")",
            host.Print(),
            "after the change"
        );
    }

    private static void ALivePropInAShowBranchIsBoundAgainWhenTheBranchComesBack(IExpect expect)
    {
        var host = new FakeHost();
        var on = Reactivity.Signal(true);
        var name = Reactivity.Signal("Ada");

        host.Render(() =>
            Show(() => on.Value, () => Card.Create(card => card.Title = Live(() => name.Value)))
        );

        expect.Equal("box\"card\"(label\"Ada\")", host.Print(), "on");

        on.Value = false;
        Reactivity.Flush();
        name.Value = "Grace";
        Reactivity.Flush();

        expect.Equal("", host.Print(), "off");

        on.Value = true;
        Reactivity.Flush();

        expect.Equal("box\"card\"(label\"Grace\")", host.Print(), "on again");

        name.Value = "Ada";
        Reactivity.Flush();

        expect.Equal("box\"card\"(label\"Ada\")", host.Print(), "re-bound");
    }
}
