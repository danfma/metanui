using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Core.Attributes;
using static Metanui.Spike.Dsl.Core.Elements;

namespace Metanui.Spike.Dsl.Variants;

/// <summary>Class component: the props are constructor parameters; a reactive prop is a Func.</summary>
public sealed class Badge(Func<string> size) : Component
{
    public override Part Render() => Span(Class("badge"), Text(() => $"size: {size()}"));
}
