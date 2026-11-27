using Metanui.Spike.Dsl.Core;

namespace Metanui.Spike.Dsl.Variants.Direct;

/// <summary>
/// A component with plain C# properties as props, mounted by <see cref="DirectBuilders.Mount{TComponent}" />:
/// the consumer's builder sets props and adds children, then Render runs once. A generic
/// <c>Use(build)</c> that calls <c>new TSelf()</c> does not transpile (MS0019: TypeScript erases the
/// type parameter), so each component exposes its own one-line factory.
/// </summary>
public abstract class Component<TSelf>
    where TSelf : Component<TSelf>
{
    public abstract El Render(El content);
}
