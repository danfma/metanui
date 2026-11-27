using Metanui.Reactive.Scenarios;

namespace Metanui.Ui.Scenarios.PortContract;

/// <summary>
/// The <see cref="INodePort" /> contract as scenarios, runnable against any implementation: each
/// scenario takes a fresh port and observes the tree through the platform's
/// <see cref="INodePortProbe" />. Children print as their text, anchors as <c>^</c>. A new platform
/// adapter (a port plus its scheduler) runs these against its own port to prove the contract.
/// </summary>
public static class PortContractScenarios
{
    /// <summary>The contract scenarios for one platform, named after <paramref name="platform" />.</summary>
    public static Scenario[] For(
        string platform,
        Func<INodePort> createPort,
        INodePortProbe probe
    ) =>
        [
            new($"{platform} port: text is created and replaced", expect =>
                TextIsCreatedAndReplaced(expect, createPort(), probe)
            ),
            new($"{platform} port: an anchor is a placeholder child", expect =>
                AnAnchorIsAPlaceholderChild(expect, createPort(), probe)
            ),
            new($"{platform} port: a null anchor appends", expect =>
                ANullAnchorAppends(expect, createPort(), probe)
            ),
            new($"{platform} port: insert goes before the anchor", expect =>
                InsertGoesBeforeTheAnchor(expect, createPort(), probe)
            ),
            new($"{platform} port: an existing child is moved before the anchor", expect =>
                AnExistingChildIsMovedBeforeTheAnchor(expect, createPort(), probe)
            ),
            new($"{platform} port: an existing child is moved last by a null anchor", expect =>
                AnExistingChildIsMovedLastByANullAnchor(expect, createPort(), probe)
            ),
            new($"{platform} port: remove takes the child out", expect =>
                RemoveTakesTheChildOut(expect, createPort(), probe)
            ),
        ];

    private static void TextIsCreatedAndReplaced(
        IExpect expect,
        INodePort port,
        INodePortProbe probe
    )
    {
        var text = port.CreateText("a");

        expect.Equal("a", probe.TextOf(text), "created");

        port.SetText(text, "b");

        expect.Equal("b", probe.TextOf(text), "replaced");
    }

    private static void AnAnchorIsAPlaceholderChild(
        IExpect expect,
        INodePort port,
        INodePortProbe probe
    )
    {
        var parent = probe.CreateParent();
        var anchor = port.CreateAnchor();

        port.Insert(parent, anchor, null);

        expect.IsTrue(probe.IsAnchor(anchor), "is anchor");
        expect.IsTrue(!probe.IsAnchor(port.CreateText("a")), "text is not an anchor");
        expect.Equal("^", Print(probe, parent), "children");
    }

    private static void ANullAnchorAppends(IExpect expect, INodePort port, INodePortProbe probe)
    {
        var parent = ParentWith(port, probe, "a", "b");

        port.Insert(parent, port.CreateText("c"), null);

        expect.Equal("a b c", Print(probe, parent), "children");
    }

    private static void InsertGoesBeforeTheAnchor(
        IExpect expect,
        INodePort port,
        INodePortProbe probe
    )
    {
        var parent = probe.CreateParent();
        var anchor = port.CreateAnchor();

        port.Insert(parent, anchor, null);
        port.Insert(parent, port.CreateText("a"), anchor);
        port.Insert(parent, port.CreateText("b"), anchor);

        expect.Equal("a b ^", Print(probe, parent), "children");
    }

    private static void AnExistingChildIsMovedBeforeTheAnchor(
        IExpect expect,
        INodePort port,
        INodePortProbe probe
    )
    {
        var parent = ParentWith(port, probe, "a", "b", "c");

        port.Insert(parent, probe.ChildAt(parent, 2), probe.ChildAt(parent, 0));

        expect.Equal("c a b", Print(probe, parent), "children");
    }

    private static void AnExistingChildIsMovedLastByANullAnchor(
        IExpect expect,
        INodePort port,
        INodePortProbe probe
    )
    {
        var parent = ParentWith(port, probe, "a", "b", "c");

        port.Insert(parent, probe.ChildAt(parent, 0), null);

        expect.Equal("b c a", Print(probe, parent), "children");
    }

    private static void RemoveTakesTheChildOut(IExpect expect, INodePort port, INodePortProbe probe)
    {
        var parent = ParentWith(port, probe, "a", "b", "c");

        port.Remove(parent, probe.ChildAt(parent, 1));

        expect.Equal("a c", Print(probe, parent), "children");
    }

    private static object ParentWith(INodePort port, INodePortProbe probe, params string[] texts)
    {
        var parent = probe.CreateParent();

        foreach (var text in texts)
        {
            port.Insert(parent, port.CreateText(text), null);
        }

        return parent;
    }

    private static string Print(INodePortProbe probe, object parent)
    {
        var printed = "";

        for (var index = 0; index < probe.ChildCount(parent); index++)
        {
            var child = probe.ChildAt(parent, index);
            var part = probe.IsAnchor(child) ? "^" : probe.TextOf(child);

            printed = printed.Length == 0 ? part : $"{printed} {part}";
        }

        return printed;
    }
}
