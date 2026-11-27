using Metanui.Reactive;

namespace Metanui.Ui.Binding;

/// <summary>An effect whose whole work runs in its tracked compute; its apply does nothing.</summary>
/// <remarks>
/// The core has no compute-only effect, so every run still queues the empty apply (v1 gap).
/// </remarks>
internal static class FusedBinding
{
    private static readonly Action<bool, bool> NoApply = static (_, _) => { };

    internal static IDisposable Start(Action write) =>
        Reactivity.Effect(
            () =>
            {
                write();

                return true;
            },
            NoApply
        );
}
