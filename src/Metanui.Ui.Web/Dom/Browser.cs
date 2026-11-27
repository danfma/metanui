using Metano.Annotations;
using Metano.Annotations.TypeScript;

namespace Metanui.Ui.Web.Dom;

/// <summary>
/// The browser globals the adapter uses. <c>[NoContainer]</c>: each member is the global itself
/// (<c>document</c>, <c>queueMicrotask</c>). On .NET every member throws.
/// </summary>
[External]
[NoContainer]
public static class Browser
{
    /// <summary>The global <c>document</c>.</summary>
    [Name("document")]
    public static Document Document => throw new NotSupportedException();

    /// <summary>Queues <paramref name="callback" /> on the microtask queue (global <c>queueMicrotask</c>).</summary>
    [Name("queueMicrotask")]
    public static void QueueMicrotask(Action callback) => throw new NotSupportedException();
}
