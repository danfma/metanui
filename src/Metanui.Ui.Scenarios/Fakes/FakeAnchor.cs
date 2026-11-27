namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>A fake anchor (a comment node on the web); the print hides it.</summary>
public sealed class FakeAnchor : FakeNode
{
    public override string Print() => "";
}
