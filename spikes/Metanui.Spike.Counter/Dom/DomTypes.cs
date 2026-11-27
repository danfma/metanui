using Metano.Annotations;
using Metano.Annotations.TypeScript;

namespace Metanui.Spike.Counter.Dom;

// The few DOM shapes the spike needs. [External] emits nothing: the names resolve to lib.dom.

[External]
public interface Node
{
    Node AppendChild(Node child);

    Node RemoveChild(Node child);
}

[External]
public interface Text : Node
{
    string Data { get; set; }
}

[External]
public interface HTMLElement : Node
{
    string TextContent { get; set; }

    string ClassName { get; set; }

    void AddEventListener(string type, Action listener);
}

[External]
public interface Document
{
    HTMLElement Body { get; }

    HTMLElement CreateElement(string tagName);

    Text CreateTextNode(string data);
}

[External]
[NoContainer]
public static class Browser
{
    [Name("document")]
    public static Document Document => throw new NotSupportedException();

    [Name("queueMicrotask")]
    public static void QueueMicrotask(Action callback) => throw new NotSupportedException();
}
