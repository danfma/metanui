using Metanui.Reactive;
using Metanui.Ui.Web.Dom;

namespace Metanui.Ui.Web;

/// <summary>The web flush scheduler (spec 0001, 4.7): a write flushes on the next microtask.</summary>
public sealed class MicrotaskScheduler : IFlushScheduler
{
    public void Schedule(Action flush) => Browser.QueueMicrotask(flush);
}
