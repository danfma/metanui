using Metanui.Reactive;
using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>The web entry point: renders a view into a DOM element.</summary>
public static class WebApp
{
    /// <summary>
    /// Builds <paramref name="build" /> into <paramref name="container" /> under a new root, through
    /// a <see cref="DomNodePort" />. Installs the <see cref="MicrotaskScheduler" /> unless it is
    /// already the scheduler, replacing any other one, so writes flush on the next microtask.
    /// </summary>
    /// <returns>A handle that disposes the whole tree and removes its nodes from the container.</returns>
    public static IDisposable Render(Action build, HTMLElement container)
    {
        if (Reactivity.Scheduler is not MicrotaskScheduler)
        {
            Reactivity.UseScheduler(new MicrotaskScheduler());
        }

        return View.Render(build, container, new DomNodePort());
    }
}
