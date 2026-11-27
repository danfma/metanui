using Metanui.Reactive.Scenarios;
using Metanui.Ui.Building;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for the builder scope: where nodes go and when building is rejected.</summary>
public static class BuildingScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario("static tree is built in order", StaticTreeIsBuiltInOrder),
        new Scenario("adding a node outside a builder throws", AddingANodeOutsideABuilderThrows),
        new Scenario(
            "builder scope is restored after a builder throws",
            BuilderScopeIsRestoredAfterABuilderThrows
        ),
    ];

    private static void StaticTreeIsBuiltInOrder(IExpect expect)
    {
        var host = new FakeHost();

        host.Render(() =>
        {
            Box(outer =>
            {
                outer.Text = "outer";
                Label("a");
                Box(inner => Label("b"));
                Text("hi");
            });

            Label("c");
        });

        expect.Equal(
            "box\"outer\"(label\"a\" box(label\"b\") 'hi') label\"c\"",
            host.Print(),
            "tree"
        );
    }

    private static void AddingANodeOutsideABuilderThrows(IExpect expect)
    {
        var element = ScenarioRunner.Catch(() => Label("x"));
        var node = ScenarioRunner.Catch(() => Builder.Add(new FakeText("x")));
        var text = ScenarioRunner.Catch(() => Text("x"));

        expect.Equal(ExpectedUiMessages.NoBuilder, element?.Message, "element");
        expect.Equal(ExpectedUiMessages.NoBuilder, node?.Message, "node");
        expect.Equal(ExpectedUiMessages.NoBuilder, text?.Message, "text");
    }

    private static void BuilderScopeIsRestoredAfterABuilderThrows(IExpect expect)
    {
        var host = new FakeHost();
        Exception? error = null;

        host.Render(() =>
        {
            Box(outer =>
            {
                error = ScenarioRunner.Catch(() =>
                    Box(inner => throw new InvalidOperationException("boom"))
                );

                Label("kept");
            });
        });

        var outside = ScenarioRunner.Catch(() => Label("x"));

        expect.Equal("boom", error?.Message, "error");
        expect.Equal("box(label\"kept\")", host.Print(), "tree");
        expect.Equal(ExpectedUiMessages.NoBuilder, outside?.Message, "outside");
    }
}
