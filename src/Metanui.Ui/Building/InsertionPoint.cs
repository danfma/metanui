using Metanui.Ui.Regions;

namespace Metanui.Ui.Building;

/// <summary>
/// Where the active builder inserts: into <see cref="Parent" /> before <see cref="Before" /> (last
/// when null), through <see cref="Port" />, recording top-level nodes in <see cref="Collector" />.
/// </summary>
internal readonly record struct InsertionPoint(
    INodePort Port,
    object Parent,
    object? Before,
    Fragment? Collector
)
{
    /// <summary>Inserts <paramref name="node" /> here and records it.</summary>
    public void Insert(object node)
    {
        Port.Insert(Parent, node, Before);
        Collector?.Add(node);
    }

    /// <summary>
    /// Inserts the end anchor of <paramref name="region" /> here and records the region, so a region
    /// around it moves the nodes the region holds at that time.
    /// </summary>
    public void InsertRegion(Region region, object end)
    {
        Port.Insert(Parent, end, Before);
        Collector?.Add(region);
    }
}
