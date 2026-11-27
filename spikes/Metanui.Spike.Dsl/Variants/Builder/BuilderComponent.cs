using Metanui.Spike.Dsl.Core;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>
/// A custom component in option G: props are <see cref="Bindable{T}" /> properties the consumer sets
/// in the builder; Render runs once, after the builder, with the children the consumer added.
/// </summary>
public abstract class BuilderComponent
{
    public abstract El Render(El content);
}
