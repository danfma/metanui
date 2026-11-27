namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>
/// A fake element with a tag, a text property and children, printed as
/// <c>tag"text"(child child)</c>; the text and the parentheses appear only when not empty.
/// </summary>
public sealed class FakeElement(string tag) : FakeNode
{
    private readonly List<FakeNode> _children = [];

    public string Tag => tag;

    public string Text { get; set; } = "";

    /// <summary>Every child, anchors included.</summary>
    public int ChildCount => _children.Count;

    public override string Print()
    {
        var text = Text.Length == 0 ? "" : $"\"{Text}\"";
        var children = PrintChildren();
        var content = children.Length == 0 ? "" : $"({children})";

        return $"{Tag}{text}{content}";
    }

    /// <summary>The visible children separated by spaces.</summary>
    public string PrintChildren()
    {
        var printed = "";

        foreach (var child in _children)
        {
            var part = child.Print();

            if (part.Length == 0)
            {
                continue;
            }

            printed = printed.Length == 0 ? part : $"{printed} {part}";
        }

        return printed;
    }

    internal void InsertBefore(FakeNode node, FakeNode? anchor)
    {
        node.Parent?.RemoveChild(node);

        var index = anchor is null ? _children.Count : IndexOf(anchor);

        _children.Insert(index, node);
        node.Parent = this;
    }

    internal void RemoveChild(FakeNode node)
    {
        _children.RemoveAt(IndexOf(node));
        node.Parent = null;
    }

    private int IndexOf(FakeNode node)
    {
        var index = _children.IndexOf(node);

        if (index < 0)
        {
            throw new InvalidOperationException($"The node is not a child of {Tag}.");
        }

        return index;
    }
}
