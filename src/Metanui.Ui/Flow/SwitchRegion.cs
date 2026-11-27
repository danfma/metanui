using Metanui.Reactive;
using Metanui.Ui.Binding;
using Metanui.Ui.Building;
using Metanui.Ui.Regions;

namespace Metanui.Ui.Flow;

/// <summary>
/// The region of a <c>Show</c>: the active branch's nodes before one end anchor. Each branch is
/// built under its own root, created in the region's effect compute, so the compute's next run (a
/// change of the condition's result) disposes it, and the branch's cleanup removes its nodes.
/// </summary>
internal sealed class SwitchRegion(INodePort port, object parent, object end) : Region(port, parent)
{
    private Fragment? _branch;

    internal override object? FirstNode => _branch?.FirstNode ?? end;

    /// <summary>
    /// Creates a switch at the ambient insertion point that shows <paramref name="then" /> while
    /// <paramref name="when" /> is true and <paramref name="otherwise" /> while it is false. The
    /// condition goes through a computed, so a source change that keeps its result rebuilds nothing.
    /// </summary>
    internal static void Start(Func<bool> when, Action then, Action? otherwise)
    {
        var port = Builder.Port;
        var anchor = port.CreateAnchor();
        var region = new SwitchRegion(port, Builder.Parent, anchor);
        var condition = Reactivity.Computed(when);

        Builder.AddRegion(region, anchor);
        Reactivity.OnCleanup(region.RemoveEnd);
        FusedBinding.Start(() => region.Present(condition.Value ? then : otherwise));
    }

    internal override void MoveBefore(object? anchor)
    {
        _branch?.MoveBefore(anchor);
        Port.Insert(Parent, end, anchor);
    }

    /// <summary>Builds <paramref name="branch" />, if any, as the active branch.</summary>
    private void Present(Action? branch) =>
        _branch = branch is null ? null : Reactivity.Root(_ => BuildBranch(branch));

    private Fragment BuildBranch(Action branch)
    {
        var fragment = new Fragment(Port, Parent, null);

        Reactivity.OnCleanup(fragment.Remove);
        Builder.Run(Port, Parent, end, fragment, branch);

        return fragment;
    }

    private void RemoveEnd() => Port.Remove(Parent, end);
}
