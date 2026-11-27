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
internal sealed class ShowRegion(INodePort port, object parent, object end) : Region(port, parent)
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
        var target = Builder.Target;
        var anchor = target.Port.CreateAnchor();
        var region = new ShowRegion(target.Port, target.Parent, anchor);
        var condition = Reactivity.Computed(when);

        target.InsertRegion(region, anchor);
        Reactivity.OnCleanup(region.RemoveEnd);
        FusedBinding.Start(() => region.Present(condition.Value ? then : otherwise));
    }

    internal override void MoveBefore(object? anchor)
    {
        _branch?.MoveBefore(anchor);
        Port.Insert(Parent, end, anchor);
    }

    /// <summary>
    /// Builds <paramref name="branch" />, if any, as the active branch. The previous branch's root
    /// was disposed when this compute started, so it is forgotten first.
    /// </summary>
    private void Present(Action? branch)
    {
        _branch = null;

        if (branch is not null)
        {
            Reactivity.Root(_ => BuildBranch(branch));
        }
    }

    /// <summary>
    /// Tracks the branch's fragment before building it, so a branch that throws midway still
    /// accounts for the nodes it inserted: they move with the region and its root's next disposal
    /// removes them.
    /// </summary>
    private void BuildBranch(Action branch)
    {
        var fragment = new Fragment(Port, Parent, null);

        _branch = fragment;
        Reactivity.OnCleanup(fragment.Remove);
        Builder.Run(Port, Parent, end, fragment, branch);
    }

    private void RemoveEnd() => Port.Remove(Parent, end);
}
