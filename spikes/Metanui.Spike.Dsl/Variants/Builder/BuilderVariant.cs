using Metanui.Reactive;
using Metanui.Spike.Dsl.Core;
using static Metanui.Spike.Dsl.Variants.Builder.Builders;

namespace Metanui.Spike.Dsl.Variants.Builder;

/// <summary>Option G: builder lambdas, with every binding form C# accepts side by side.</summary>
public static class BuilderVariant
{
    public static Part Counter()
    {
        var count = Reactivity.Signal(0);

        return Section(section =>
        {
            section.ClassName = "variant";

            H2(title => title.TextContent = "G. Builder lambdas");

            // 1. Explicit source, value passed in.
            P(p => Bind(count, value => p.TextContent = $"1. Count: {value}"));

            // 2. Explicit source, body untracked.
            P(p => Bind(count, () => p.TextContent = $"2. Count: {count.Value}"));

            // 3. Operator: static << plus the property setter.
            P(p =>
            {
                p.TextContent = "3. parity";
                p.ClassName <<= () => count.Value % 2 == 0 ? "even" : "odd";
            });

            // 4a. Unified value: Bind over a lambda.
            P(p => p.TextContent = Bind(() => $"4a. Count: {count.Value}"));

            // 4b. Unified value: Bind over a template whose signal holes stay live. Off in the web build:
            // Metano lowers the interpolated string to a template literal instead of the handler calls,
            // so Bind receives a string (Metano #828). On .NET it works.
            // P(p => p.TextContent = Bind($"4b. Count: {count}"));

            Button(button =>
            {
                button.TextContent = "-1";
                button.OnClick = _ => count.Value--;
            });

            Button(button =>
            {
                button.TextContent = "+1";
                button.OnClick = _ => count.Value++;
            });

            Add(new Badge(() => count.Value > 5 ? "big" : "small"));
        });
    }
}
