namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>A fake text node, printed as <c>'value'</c>.</summary>
public sealed class FakeText(string value) : FakeNode
{
    public string Value { get; set; } = value;

    public override string Print() => $"'{Value}'";
}
