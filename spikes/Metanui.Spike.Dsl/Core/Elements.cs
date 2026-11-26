namespace Metanui.Spike.Dsl.Core;

/// <summary>Hyperscript-like factories: attributes and children in one list, in HTML order.</summary>
public static class Elements
{
    public static El Div(params Part[] parts) => El.Create("div", parts);

    public static El Section(params Part[] parts) => El.Create("section", parts);

    public static El H2(params Part[] parts) => El.Create("h2", parts);

    public static El P(params Part[] parts) => El.Create("p", parts);

    public static El Span(params Part[] parts) => El.Create("span", parts);

    public static El Button(params Part[] parts) => El.Create("button", parts);
}
