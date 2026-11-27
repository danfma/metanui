using Metanui.Reactive;
using Metanui.Ui.Building;
using Metanui.Ui.Regions;

namespace Metanui.Ui.Rendering;

/// <summary>A view rendered into a container; disposing it disposes the tree and removes its nodes.</summary>
internal sealed class RenderedView(Action disposeRoot) : IDisposable
{
    /// <summary>
    /// Builds <paramref name="build" /> into <paramref name="container" /> under a new root. When the
    /// build throws, the root is disposed, so no node or binding is left behind.
    /// </summary>
    internal static IDisposable Start(Action build, object container, INodePort port) =>
        Reactivity.Root<IDisposable>(disposeRoot =>
        {
            var view = new RenderedView(disposeRoot);
            var topLevel = new Fragment(port, container, null);

            Reactivity.OnCleanup(topLevel.Remove);

            try
            {
                Builder.Run(port, container, null, topLevel, build);
            }
            catch
            {
                view.Dispose();

                throw;
            }

            return view;
        });

    public void Dispose() => disposeRoot();
}
