using Metano.Annotations;

namespace Metanui.Reactive.Graph;

/// <summary>
/// Node state bits, with the values used by alien-signals. Bits 64 and above are reserved for
/// the pending-async and error states (design 5.4).
/// </summary>
[Flags]
[Transpile]
internal enum ReactiveFlags
{
    None = 0,
    Mutable = 1,
    Watching = 2,
    RecursedCheck = 4,
    Recursed = 8,
    Dirty = 16,
    Pending = 32,
}
