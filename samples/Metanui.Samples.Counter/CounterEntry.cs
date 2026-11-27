namespace Metanui.Samples.Counter;

/// <summary>A list entry: the id its counter keeps while it stays in the list.</summary>
public sealed class CounterEntry(int id)
{
    public int Id => id;
}
