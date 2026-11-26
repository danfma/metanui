using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;

namespace Metanui.Spike.Dsl.Core;

/// <summary>Attribute and text functions shared by the variants; T/Func&lt;T&gt; overloads choose static or reactive.</summary>
public static class Attributes
{
    public static Part Class(string value) =>
        new AttributePart(element => element.ClassName = value);

    public static Part Class(Func<string> value) =>
        new AttributePart(element =>
            Reactivity.Effect(value, (current, previous) => element.ClassName = current)
        );

    public static Part OnClick(Action handler) =>
        new AttributePart(element => element.AddEventListener("click", handler));

    public static Part Text(Func<string> text) => new ReactiveTextPart(text);
}
