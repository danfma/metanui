namespace Metanui.Reactive.Scenarios;

/// <summary>Assertion port each platform adapter implements for the shared scenarios.</summary>
public interface IExpect
{
    void Equal<T>(T expected, T actual, string label);

    void IsTrue(bool condition, string label);
}
