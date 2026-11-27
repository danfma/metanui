using Metanui.Ui.Scenarios.PortContract;

namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>Observes the fake tree for <see cref="PortContractScenarios" />.</summary>
public sealed class FakePortProbe : INodePortProbe
{
    public object CreateParent() => new FakeElement("parent");

    public int ChildCount(object parent) => ((FakeElement)parent).ChildCount;

    public object ChildAt(object parent, int index) => ((FakeElement)parent).ChildAt(index);

    public bool IsAnchor(object node) => node is FakeAnchor;

    public string TextOf(object node) => ((FakeText)node).Value;
}
