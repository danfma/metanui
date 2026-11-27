namespace Metanui.Ui.Binding;

/// <summary>
/// The apply of a split bind: writes the first value, then only values that differ from the
/// previous one (<see cref="EqualityComparer{T}.Default" />).
/// </summary>
internal sealed class SplitBinding<T>(Action<T> write)
{
    private bool _hasWritten;

    /// <summary>
    /// The effect's apply. <paramref name="previous" /> is the value of the previous apply, which was
    /// written unless it equalled the one before, so it is the value on the target.
    /// </summary>
    internal void Apply(T value, T previous)
    {
        if (_hasWritten && EqualityComparer<T>.Default.Equals(value, previous))
        {
            return;
        }

        _hasWritten = true;
        write(value);
    }
}
