using Metanui.Reactive;
using Metanui.Spike.Counter.Dom;
using Metanui.Spike.Counter.Ui;
using Metanui.Spike.Dsl.Variants;
using Metanui.Spike.Dsl.Variants.Builder;
using Metanui.Spike.Dsl.Variants.Components;
using Metanui.Spike.Dsl.Variants.Direct;
using Metanui.Spike.Dsl.Variants.Initializers;

namespace Metanui.Spike.Dsl;

/// <summary>Mounts the variants side by side.</summary>
public static class Gallery
{
    public static void Main()
    {
        Reactivity.UseScheduler(new MicrotaskScheduler());
        Reactivity.Root(dispose =>
        {
            var body = Browser.Document.Body;

            RecordPropsVariant.Counter().AttachTo(body);
            AttributeListVariant.Counter().AttachTo(body);
            CollectionInitializerVariant.Counter().AttachTo(body);
            FluentVariant.Counter().AttachTo(body);
            new GroupedBindCounter().AttachTo(body);
            BuilderVariant.Counter().AttachTo(body);
            CardCUsage.Cards().AttachTo(body);
            CardGUsage.Cards().AttachTo(body);
            DirectUsage.Gallery().AttachTo(body);
        });
    }
}
