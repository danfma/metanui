namespace Metanui.Ui.Tests;

/// <summary>
/// .NET-only: Metano requires a <see cref="Prop{T}" /> to be initialized (MS0001), so
/// <c>default</c> cannot be written in the shared scenarios.
/// </summary>
public sealed class PropTests
{
    [Test]
    public async Task DefaultReadsTheDefaultValue()
    {
        await Assert.That(default(Prop<int>).Value).IsEqualTo(0);
        await Assert.That(default(Prop<string>).Value).IsNull();
    }
}
