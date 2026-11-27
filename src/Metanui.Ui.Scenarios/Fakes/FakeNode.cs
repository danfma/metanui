namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>A node of the fake platform tree the scenarios render into.</summary>
public abstract class FakeNode
{
    /// <summary>The element this node is a child of; null while detached.</summary>
    public FakeElement? Parent { get; internal set; }

    /// <summary>The node as compact text, or an empty string for a node the print hides.</summary>
    public abstract string Print();
}
