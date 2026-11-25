namespace Metanui.Reactive.Scenarios;

/// <summary>Messages of the core exceptions the scenarios assert on.</summary>
public static class ExpectedMessages
{
    public const string PassLimit =
        "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";
}
