using Metanui.Ui.Building;

namespace Metanui.Ui.Scenarios.Fakes;

/// <summary>
/// A tiny fake element vocabulary, built on the same public scope API as a platform package.
/// </summary>
public static class FakeViews
{
    public static void Box(Action<FakeElement> build) =>
        Builder.Create(new FakeElement("box"), build);

    public static void Label(Action<FakeElement> build) =>
        Builder.Create(new FakeElement("label"), build);

    public static void Label(string text) => Builder.Add(new FakeElement("label") { Text = text });
}
