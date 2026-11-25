namespace Metanui.Reactive.Graph;

/// <summary>
/// Node state bits. Bits up to 32 are the values used by alien-signals; <see cref="Errored" /> is
/// the first bit above them, and the bits above it are reserved for the pending-async state
/// (design 5.4).
/// </summary>
[Flags]
internal enum ReactiveFlags
{
    None = 0,
    Mutable = 1,
    Watching = 2,
    RecursedCheck = 4,
    Recursed = 8,
    Dirty = 16,
    Pending = 32,

    /// <summary>The last run of a computed threw; it holds the exception instead of a value.</summary>
    Errored = 64,
}
