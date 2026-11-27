namespace Metanui.Ui.Scenarios.PortContract;

/// <summary>
/// What <see cref="PortContractScenarios" /> needs to observe one platform's tree: a parent to
/// insert into, and a read-only view of its children.
/// </summary>
public interface INodePortProbe
{
    /// <summary>Creates an empty, detached element that can hold children.</summary>
    object CreateParent();

    /// <summary>The number of children of <paramref name="parent" />, anchors included.</summary>
    int ChildCount(object parent);

    /// <summary>The child of <paramref name="parent" /> at <paramref name="index" />.</summary>
    object ChildAt(object parent, int index);

    /// <summary>Whether <paramref name="node" /> was created by <see cref="INodePort.CreateAnchor" />.</summary>
    bool IsAnchor(object node);

    /// <summary>The content of a text node created by <see cref="INodePort.CreateText" />.</summary>
    string TextOf(object node);
}
