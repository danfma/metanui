using Metanui.Reactive;
using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>The web entry point: renders a view into a DOM element.</summary>
public static class WebApp
{
    /// <summary>
    /// Builds <paramref name="build" /> into <paramref name="container" /> under a new root, through
    /// a <see cref="DomNodePort" />, after <see cref="EnsureMicrotaskScheduler" />.
    /// </summary>
    /// <returns>A handle that disposes the whole tree and removes its nodes from the container.</returns>
    public static IDisposable Render(Action build, HTMLElement container)
    {
        EnsureMicrotaskScheduler();

        return View.Render(build, container, new DomNodePort());
    }

    /// <summary>
    /// Installs a <see cref="MicrotaskScheduler" /> when the reactive core still runs on its default
    /// <see cref="ManualFlushScheduler" />, so writes flush on the next microtask. A scheduler that the
    /// host configured with <see cref="Reactivity.UseScheduler" /> is kept.
    /// </summary>
    /// <remarks>
    /// The scheduler is a process-wide choice of the reactive core, not a per-view one: every view and
    /// every signal of the page flush through it. Any <see cref="ManualFlushScheduler" /> counts as the
    /// default, since nothing would ever flush the page's writes.
    /// </remarks>
    public static void EnsureMicrotaskScheduler()
    {
        if (Reactivity.Scheduler is ManualFlushScheduler)
        {
            Reactivity.UseScheduler(new MicrotaskScheduler());
        }
    }
}
