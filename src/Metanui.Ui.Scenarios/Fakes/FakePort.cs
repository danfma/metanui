namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>
/// The node port over the fake tree, with DOM semantics: inserting an attached node moves it, and
/// removing a node that is not a child of the given parent throws.
/// </summary>
public sealed class FakePort : INodePort
{
    /// <summary>Inserts of nodes that were already attached, i.e. moves.</summary>
    public int Moves { get; private set; }

    public object CreateText(string text) => new FakeText(text);

    public void SetText(object text, string value) => ((FakeText)text).Value = value;

    public object CreateAnchor() => new FakeAnchor();

    public void Insert(object parent, object node, object? anchor)
    {
        var child = (FakeNode)node;

        if (child.Parent is not null)
        {
            Moves++;
        }

        ((FakeElement)parent).InsertBefore(child, (FakeNode?)anchor);
    }

    public void Remove(object parent, object node)
    {
        var child = (FakeNode)node;

        if (child.Parent != parent)
        {
            throw new InvalidOperationException("The node to remove is not a child of the parent.");
        }

        ((FakeElement)parent).RemoveChild(child);
    }
}
