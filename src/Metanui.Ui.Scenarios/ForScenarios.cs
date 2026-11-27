using Metanui.Reactive;
using Metanui.Reactive.Scenarios;
using Metanui.Ui.Scenarios.Fakes;
using static Metanui.Ui.Scenarios.Fakes.FakeViews;
using static Metanui.Ui.View;

namespace Metanui.Ui.Scenarios;

/// <summary>Scenarios for <c>For</c>: item regions kept, moved and removed.</summary>
public static class ForScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "for keeps item state across add, remove and reorder",
            ForKeepsItemStateAcrossAddRemoveAndReorder
        ),
        new Scenario("for moves only the items out of place", ForMovesOnlyTheItemsOutOfPlace),
        new Scenario(
            "a prepend or a middle insert moves no kept item",
            APrependOrAMiddleInsertMovesNoKeptItem
        ),
        new Scenario(
            "an item that throws inside a boundary leaves the list consistent",
            AnItemThatThrowsInsideABoundaryLeavesTheListConsistent
        ),
        new Scenario(
            "keyed for keeps an item whose record changes",
            KeyedForKeepsAnItemWhoseRecordChanges
        ),
        new Scenario(
            "moved items take their nested regions along",
            MovedItemsTakeTheirNestedRegionsAlong
        ),
        new Scenario(
            "an item rendering several nodes moves them together",
            AnItemRenderingSeveralNodesMovesThemTogether
        ),
        new Scenario(
            "clearing the list removes every item node",
            ClearingTheListRemovesEveryItemNode
        ),
        new Scenario("for stays between its siblings", ForStaysBetweenItsSiblings),
    ];

    private static void ForKeepsItemStateAcrossAddRemoveAndReorder(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c"]);
        var renders = 0;
        var disposed = new List<string>();

        host.Render(() =>
            For(
                () => items.Value,
                item =>
                {
                    renders++;
                    Reactivity.OnCleanup(() => disposed.Add(item));
                    Label(item);
                }
            )
        );

        expect.Equal("label\"a\" label\"b\" label\"c\"", host.Print(), "initial");

        items.Value = ["d", "a", "b", "c"];
        Reactivity.Flush();

        expect.Equal("label\"d\" label\"a\" label\"b\" label\"c\"", host.Print(), "added");
        expect.Equal(4, renders, "only the added item renders");

        items.Value = ["d", "a", "c"];
        Reactivity.Flush();

        expect.Equal("label\"d\" label\"a\" label\"c\"", host.Print(), "removed");
        expect.Equal("b", string.Join(",", disposed), "only the removed item is disposed");

        items.Value = ["c", "a", "d"];
        Reactivity.Flush();

        expect.Equal("label\"c\" label\"a\" label\"d\"", host.Print(), "reordered");
        expect.Equal(4, renders, "a reorder renders nothing");
        expect.Equal(1, disposed.Count, "a reorder disposes nothing");
    }

    /// <summary>Each moved item moves its node and its end anchor: two port inserts.</summary>
    private static void ForMovesOnlyTheItemsOutOfPlace(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c", "d", "e"]);

        host.Render(() => For(() => items.Value, item => Label(item)));

        items.Value = ["a", "d", "c", "b", "e"];
        Reactivity.Flush();

        expect.Equal(
            "label\"a\" label\"d\" label\"c\" label\"b\" label\"e\"",
            host.Print(),
            "swapped"
        );

        expect.Equal(4, host.Port.Moves, "two items move");

        items.Value = ["e", "b", "c", "d", "a"];
        Reactivity.Flush();

        expect.Equal(
            "label\"e\" label\"b\" label\"c\" label\"d\" label\"a\"",
            host.Print(),
            "reversed"
        );

        expect.Equal(12, host.Port.Moves, "four more items move");
    }

    /// <summary>
    /// A new item is rendered last, then moved once into place: its node and its end anchor, two
    /// port moves, and no kept item moves.
    /// </summary>
    private static void APrependOrAMiddleInsertMovesNoKeptItem(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c"]);

        host.Render(() => For(() => items.Value, item => Label(item)));

        items.Value = ["d", "a", "b", "c"];
        Reactivity.Flush();

        expect.Equal("label\"d\" label\"a\" label\"b\" label\"c\"", host.Print(), "prepended");
        expect.Equal(2, host.Port.Moves, "only the prepended item moves");

        items.Value = ["d", "a", "x", "b", "c"];
        Reactivity.Flush();

        expect.Equal(
            "label\"d\" label\"a\" label\"x\" label\"b\" label\"c\"",
            host.Print(),
            "inserted in the middle"
        );

        expect.Equal(4, host.Port.Moves, "only the inserted item moves");
    }

    /// <summary>
    /// A failed map run keeps the previous mapping and disposes the items it created, which were
    /// never linked; the list then follows the next change.
    /// </summary>
    private static void AnItemThatThrowsInsideABoundaryLeavesTheListConsistent(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);
        var errors = new List<string>();

        Reactivity.ErrorBoundary(
            () =>
                host.Render(() =>
                    For(
                        () => items.Value,
                        item =>
                        {
                            Label(item);

                            if (item == "x")
                            {
                                throw new InvalidOperationException("boom");
                            }
                        }
                    )
                ),
            error => errors.Add(error.Message)
        );

        items.Value = ["a", "x", "b"];
        Reactivity.Flush();

        expect.Equal("boom", string.Join(",", errors), "routed to the boundary");
        expect.Equal("label\"a\" label\"b\"", host.Print(), "the failed item left no node");

        items.Value = ["b", "a"];
        Reactivity.Flush();

        expect.Equal("label\"b\" label\"a\"", host.Print(), "the list follows the next change");
        expect.Equal(5, host.Container.ChildCount, "two labels, two item anchors, the list anchor");
    }

    private static void KeyedForKeepsAnItemWhoseRecordChanges(IExpect expect)
    {
        var host = new FakeHost();
        var renders = 0;

        var items = Reactivity.Signal<IReadOnlyList<Entry>>([
            new Entry(1, "one"),
            new Entry(2, "two"),
        ]);

        host.Render(() =>
            For(
                () => items.Value,
                entry => entry.Id,
                entry =>
                {
                    renders++;
                    Label(entry.Name);
                }
            )
        );

        items.Value = [new Entry(2, "two"), new Entry(1, "uno")];
        Reactivity.Flush();

        expect.Equal("label\"two\" label\"one\"", host.Print(), "kept by key, moved");
        expect.Equal(2, renders, "nothing renders again");
    }

    private static void MovedItemsTakeTheirNestedRegionsAlong(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);
        var marked = Reactivity.Signal(true);

        host.Render(() =>
            For(
                () => items.Value,
                item =>
                {
                    Label(item);
                    Show(() => marked.Value, () => Label($"{item}!"));
                    For(() => items.Value, inner => Label($"{item}{inner}"));
                }
            )
        );

        items.Value = ["b", "a"];
        Reactivity.Flush();

        expect.Equal(
            "label\"b\" label\"b!\" label\"bb\" label\"ba\" label\"a\" label\"a!\" label\"ab\" label\"aa\"",
            host.Print(),
            "reordered with nested regions"
        );

        marked.Value = false;
        Reactivity.Flush();

        expect.Equal(
            "label\"b\" label\"bb\" label\"ba\" label\"a\" label\"ab\" label\"aa\"",
            host.Print(),
            "nested branch hidden in place"
        );
    }

    private static void AnItemRenderingSeveralNodesMovesThemTogether(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c"]);

        host.Render(() =>
            For(
                () => items.Value,
                item =>
                {
                    Label(item);
                    Text(item);
                }
            )
        );

        items.Value = ["c", "a", "b"];
        Reactivity.Flush();

        expect.Equal(
            "label\"c\" 'c' label\"a\" 'a' label\"b\" 'b'",
            host.Print(),
            "nodes moved as a group"
        );
    }

    private static void ClearingTheListRemovesEveryItemNode(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);
        var live = 0;

        host.Render(() =>
            For(
                () => items.Value,
                item =>
                {
                    live++;
                    Reactivity.OnCleanup(() => live--);
                    Box(box => Label(item));
                }
            )
        );

        items.Value = [];
        Reactivity.Flush();

        expect.Equal("", host.Print(), "empty");
        expect.Equal(1, host.Container.ChildCount, "only the list's end anchor is left");
        expect.Equal(0, live, "every item is disposed");
    }

    private static void ForStaysBetweenItsSiblings(IExpect expect)
    {
        var host = new FakeHost();
        var items = Reactivity.Signal<IReadOnlyList<string>>([]);

        host.Render(() =>
        {
            Label("first");
            For(() => items.Value, item => Label(item));
            Label("last");
        });

        items.Value = ["a", "b"];
        Reactivity.Flush();

        expect.Equal("label\"first\" label\"a\" label\"b\" label\"last\"", host.Print(), "tree");
        expect.Equal(0, host.Port.Moves, "an append moves nothing");
    }

    private sealed record Entry(int Id, string Name);
}
