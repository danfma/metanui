namespace Metanui.Reactive.Scenarios;

/// <summary>Scenarios for the keyed map (<see cref="Reactivity.Map{T, TResult}" />, spec 4.8).</summary>
public static class MapScenarios
{
    public static Scenario[] All { get; } =
    [
        new Scenario(
            "items created in a computed are disposed when it reruns",
            ItemsCreatedInAComputedAreDisposedWhenItReruns
        ),
        new Scenario(
            "map keeps item owners across source reruns",
            MapKeepsItemOwnersAcrossSourceReruns
        ),
        new Scenario("map is lazy and maps only added items", MapIsLazyAndMapsOnlyAddedItems),
        new Scenario(
            "removing the first, middle or last item disposes only that item",
            RemovingAnItemDisposesOnlyThatItem
        ),
        new Scenario(
            "reorder keeps every item and follows the new order",
            ReorderKeepsEveryItemAndFollowsTheNewOrder
        ),
        new Scenario(
            "replacing all items disposes the old ones and maps the new ones",
            ReplacingAllItemsDisposesTheOldOnesAndMapsTheNewOnes
        ),
        new Scenario("clearing the source disposes every item", ClearingTheSourceDisposesEveryItem),
        new Scenario("duplicate records pair in order", DuplicateRecordsPairInOrder),
        new Scenario(
            "key selector keeps a mutated item and its result",
            KeySelectorKeepsAMutatedItemAndItsResult
        ),
        new Scenario("disposing the owner disposes every item", DisposingTheOwnerDisposesEveryItem),
        new Scenario("cleanups run once per removed item", CleanupsRunOncePerRemovedItem),
        new Scenario("unchanged rerun keeps the list instance", UnchangedRerunKeepsTheListInstance),
        new Scenario(
            "item state survives unrelated additions",
            ItemStateSurvivesUnrelatedAdditions
        ),
        new Scenario("reads in map are not tracked", ReadsInMapAreNotTracked),
        new Scenario("writing a signal in map or key throws", WritingASignalInMapOrKeyThrows),
        new Scenario(
            "exception in map keeps the previous mapping",
            ExceptionInMapKeepsThePreviousMapping
        ),
        new Scenario(
            "losing the last observer keeps the items",
            LosingTheLastObserverKeepsTheItems
        ),
        new Scenario(
            "map that disposes its owner leaves no item alive",
            MapThatDisposesItsOwnerLeavesNoItemAlive
        ),
        new Scenario("creating a map in an apply throws", CreatingAMapInAnApplyThrows),
        new Scenario(
            "cleanup error raised in map waits for the next flush",
            CleanupErrorRaisedInMapWaitsForTheNextFlush
        ),
        new Scenario(
            "key hash that throws leaves no stale index for the next run",
            KeyHashThatThrowsLeavesNoStaleIndexForTheNextRun
        ),
        new Scenario(
            "effect created in map routes its error to the boundary above the map",
            EffectCreatedInMapRoutesItsErrorToTheBoundaryAboveTheMap
        ),
    ];

    /// <summary>
    /// The spike failure that motivates <c>Map</c>: an item root created in a computation is owned
    /// by it and disposed when it reruns, so every item dies on each change of the list.
    /// </summary>
    private static void ItemsCreatedInAComputedAreDisposedWhenItReruns(IExpect expect)
    {
        var disposals = 0;
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);

        var mapped = Reactivity.Computed(() =>
        {
            foreach (var item in items.Value)
            {
                Reactivity.Root(_ => Reactivity.OnCleanup(() => disposals++));
            }

            return items.Value.Count;
        });

        Reactivity.Effect(() => mapped.Value, (_, _) => { });
        items.Value = ["a", "b"];
        Reactivity.Flush();
        items.Value = ["a", "b", "c"];
        Reactivity.Flush();

        expect.Equal(3, disposals, "every item root of the two previous runs is disposed");
    }

    private static void MapKeepsItemOwnersAcrossSourceReruns(IExpect expect)
    {
        var disposals = 0;
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                Reactivity.OnCleanup(() => disposals++);

                return item;
            }
        );

        Reactivity.Effect(() => mapped().Count, (_, _) => { });
        items.Value = ["a", "b"];
        Reactivity.Flush();
        items.Value = ["a", "b", "c"];
        Reactivity.Flush();

        expect.Equal(0, disposals, "kept items are never disposed");
    }

    private static void MapIsLazyAndMapsOnlyAddedItems(IExpect expect)
    {
        var log = "";
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                log += item + ",";

                return item.ToUpperInvariant();
            }
        );

        expect.Equal("", log, "nothing is mapped before the first read");
        expect.Equal("A,B", Join(mapped()), "first read");

        items.Value = ["a", "b", "c"];
        Reactivity.Flush();

        expect.Equal("A,B,C", Join(mapped()), "after append");

        items.Value = ["z", "a", "b", "c"];
        Reactivity.Flush();

        expect.Equal("Z,A,B,C", Join(mapped()), "after prepend");

        items.Value = ["z", "a", "m", "b", "c"];
        Reactivity.Flush();

        expect.Equal("Z,A,M,B,C", Join(mapped()), "after insert in the middle");
        expect.Equal("a,b,c,z,m,", log, "each item is mapped once");
    }

    private static void RemovingAnItemDisposesOnlyThatItem(IExpect expect)
    {
        var log = "";
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c", "d", "e"]);
        var mapped = Reactivity.Map(() => items.Value, item => LogCleanup(item, () => log += item));

        Reactivity.Effect(() => mapped(), (_, _) => { });
        items.Value = ["b", "c", "d", "e"];
        Reactivity.Flush();

        expect.Equal("a", log, "removing the first");
        expect.Equal("b,c,d,e", Join(mapped()), "list after removing the first");

        items.Value = ["b", "c", "e"];
        Reactivity.Flush();

        expect.Equal("ad", log, "removing the middle");
        expect.Equal("b,c,e", Join(mapped()), "list after removing the middle");

        items.Value = ["b", "c"];
        Reactivity.Flush();

        expect.Equal("ade", log, "removing the last");
        expect.Equal("b,c", Join(mapped()), "list after removing the last");
    }

    private static void ReorderKeepsEveryItemAndFollowsTheNewOrder(IExpect expect)
    {
        var maps = 0;
        var disposals = 0;
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c", "d"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                maps++;
                Reactivity.OnCleanup(() => disposals++);

                return item;
            }
        );

        var before = mapped();

        items.Value = ["d", "b", "c", "a"];
        Reactivity.Flush();

        var swapped = mapped();

        items.Value = ["c", "a", "d", "b"];
        Reactivity.Flush();

        expect.Equal("d,b,c,a", Join(swapped), "swap follows the new order");
        expect.Equal("c,a,d,b", Join(mapped()), "shuffle follows the new order");
        expect.IsTrue(!ReferenceEquals(before, swapped), "a move returns a new list");
        expect.Equal("a,b,c,d", Join(before), "the list an observer received is not mutated");
        expect.Equal(4, maps, "no item is mapped again");
        expect.Equal(0, disposals, "no item is disposed");
    }

    private static void ReplacingAllItemsDisposesTheOldOnesAndMapsTheNewOnes(IExpect expect)
    {
        var log = "";
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                log += "+" + item;

                return LogCleanup(item, () => log += "-" + item);
            }
        );

        mapped();
        items.Value = ["c", "d"];
        Reactivity.Flush();

        expect.Equal("c,d", Join(mapped()), "list after the replacement");
        expect.Equal("+a+b+c+d-a-b", log, "new items map, then old ones are disposed in order");
    }

    private static void ClearingTheSourceDisposesEveryItem(IExpect expect)
    {
        var log = "";
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b", "c"]);
        var mapped = Reactivity.Map(() => items.Value, item => LogCleanup(item, () => log += item));

        mapped();
        items.Value = [];
        Reactivity.Flush();

        expect.Equal(0, mapped().Count, "empty list");
        expect.Equal("abc", log, "every item is disposed, in list order");
    }

    private static void DuplicateRecordsPairInOrder(IExpect expect)
    {
        var created = 0;
        var log = "";
        var items = Reactivity.Signal<IReadOnlyList<Row>>([new Row(1, "x"), new Row(1, "x")]);

        var mapped = Reactivity.Map(
            () => items.Value,
            row =>
            {
                created++;

                var serial = created;

                Reactivity.OnCleanup(() => log += serial);

                return serial;
            }
        );

        expect.Equal("1,2", Join(mapped()), "each occurrence is its own item");

        items.Value = [new Row(1, "x"), new Row(2, "y"), new Row(1, "x")];
        Reactivity.Flush();

        expect.Equal("1,3,2", Join(mapped()), "equal records keep their items in order");

        items.Value = [new Row(1, "x")];
        Reactivity.Flush();

        expect.Equal("1", Join(mapped()), "the first occurrence pairs with the first");
        expect.Equal("32", log, "the removed record, then the extra occurrence, in list order");

        items.Value = [new Row(1, "x"), new Row(1, "x"), new Row(1, "x")];
        Reactivity.Flush();

        expect.Equal("1,4,5", Join(mapped()), "extra occurrences are created");
    }

    private static void KeySelectorKeepsAMutatedItemAndItsResult(IExpect expect)
    {
        var maps = 0;
        var first = new Entry(1, "one");
        var second = new Entry(2, "two");
        var items = Reactivity.Signal<IReadOnlyList<Entry>>([first, second]);

        var mapped = Reactivity.Map(
            () => items.Value,
            entry => entry.Id,
            entry =>
            {
                maps++;

                return entry.Name;
            }
        );

        expect.Equal("one,two", Join(mapped()), "first read");

        first.Name = "uno";
        items.Value = [second, first, new Entry(2, "dos")];
        Reactivity.Flush();

        expect.Equal("two,one,dos", Join(mapped()), "kept keys keep their result");
        expect.Equal(3, maps, "only the extra occurrence of key 2 is mapped");

        items.Value = [new Entry(2, "deux"), first];
        Reactivity.Flush();

        expect.Equal("two,one", Join(mapped()), "a new instance with a kept key is not mapped");
        expect.Equal(3, maps, "no remap for a kept key");
    }

    private static void DisposingTheOwnerDisposesEveryItem(IExpect expect)
    {
        var disposals = 0;
        var dispose = () => { };

        // Metano #843: an explicitly typed delegate local
        // loses its type in TS, so the map comes back from the root body instead.
        var mapped = Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;

            return Reactivity.Map<string, string>(
                () => ["a", "b", "c"],
                item => LogCleanup(item, () => disposals++)
            );
        });

        expect.Equal("a,b,c", Join(mapped()), "read before the disposal");

        dispose();

        expect.Equal(3, disposals, "every item owner is disposed");
        expect.Equal("a,b,c", Join(mapped()), "a later read returns the last list");
    }

    private static void CleanupsRunOncePerRemovedItem(IExpect expect)
    {
        var log = "";
        var tick = Reactivity.Signal(0);
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);

        var mapped = Reactivity.Map(
            () =>
            {
                _ = tick.Value;

                return items.Value;
            },
            item => LogCleanup(item, () => log += item)
        );

        Reactivity.Effect(() => mapped(), (_, _) => { });
        items.Value = ["b"];
        Reactivity.Flush();
        tick.Value = 1;
        Reactivity.Flush();
        items.Value = ["b", "c"];
        Reactivity.Flush();

        expect.Equal("a", log, "the removed item is disposed once");
    }

    private static void UnchangedRerunKeepsTheListInstance(IExpect expect)
    {
        var sourceRuns = 0;
        var observerRuns = 0;
        var tick = Reactivity.Signal(0);

        var mapped = Reactivity.Map(
            () =>
            {
                sourceRuns++;
                _ = tick.Value;

                IReadOnlyList<Row> rows = [new Row(1, "x"), new Row(2, "y")];

                return rows;
            },
            row => row.Name
        );

        Reactivity.Effect(
            () =>
            {
                observerRuns++;

                return mapped();
            },
            (_, _) => { }
        );

        var before = mapped();

        tick.Value = 1;
        Reactivity.Flush();

        expect.Equal(2, sourceRuns, "the source reran");
        expect.IsTrue(ReferenceEquals(before, mapped()), "same list instance");
        expect.Equal(1, observerRuns, "the observer does not rerun");
    }

    private static void ItemStateSurvivesUnrelatedAdditions(IExpect expect)
    {
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);
        var mapped = Reactivity.Map(() => items.Value, item => Reactivity.Signal(item + "0"));

        mapped()[0].Value = "a1";
        Reactivity.Flush();
        items.Value = ["z", "a", "b"];
        Reactivity.Flush();

        var counters = mapped();

        expect.Equal("z0", counters[0].Value, "the new item has fresh state");
        expect.Equal("a1", counters[1].Value, "the kept item keeps its signal");
        expect.Equal("b0", counters[2].Value, "the appended item has fresh state");
    }

    private static void ReadsInMapAreNotTracked(IExpect expect)
    {
        var sourceRuns = 0;
        var label = Reactivity.Signal("!");
        var keyLabel = Reactivity.Signal("?");

        var mapped = Reactivity.Map<string, string, string>(
            () =>
            {
                sourceRuns++;

                return ["a"];
            },
            item => item + keyLabel.Value,
            item => item + label.Value
        );

        Reactivity.Effect(() => mapped(), (_, _) => { });
        label.Value = "?";
        keyLabel.Value = "!";
        Reactivity.Flush();

        expect.Equal(1, sourceRuns, "a read in map or key does not rerun the map");
        expect.Equal("a!", Join(mapped()), "the result keeps the first mapping");
    }

    private static void WritingASignalInMapOrKeyThrows(IExpect expect)
    {
        var target = Reactivity.Signal(0);

        var inMap = Reactivity.Map<string, int>(
            () => ["a"],
            item =>
            {
                target.Value = 1;

                return 0;
            }
        );

        var inKey = Reactivity.Map<string, int, string>(
            () => ["a"],
            item =>
            {
                target.Value = 1;

                return 0;
            },
            item => item
        );

        expect.IsTrue(
            ScenarioRunner.Catch(() => inMap()) is InvalidOperationException,
            "write in map throws"
        );
        expect.IsTrue(
            ScenarioRunner.Catch(() => inKey()) is InvalidOperationException,
            "write in key throws"
        );
    }

    private static void ExceptionInMapKeepsThePreviousMapping(IExpect expect)
    {
        var log = "";
        var maps = 0;
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                maps++;

                var result = LogCleanup(item, () => log += item);

                return item == "boom" ? throw new InvalidOperationException(item) : result;
            }
        );

        var before = mapped();

        items.Value = ["b", "boom"];
        Reactivity.Flush();

        var error = ScenarioRunner.Catch(() => mapped());

        expect.IsTrue(error is InvalidOperationException, "the error reaches the reader");
        expect.Equal("bboom", log, "the owners the aborted run created are disposed");

        items.Value = ["a", "c"];
        Reactivity.Flush();

        expect.Equal("a,c", Join(mapped()), "a later change maps against the previous mapping");
        expect.Equal(4, maps, "the kept item is not mapped again");
        expect.Equal("bboom", log, "the kept item was never disposed");
        expect.Equal("a", Join(before), "the previous list is untouched");
    }

    private static void LosingTheLastObserverKeepsTheItems(IExpect expect)
    {
        var maps = 0;
        var disposals = 0;
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);

        var mapped = Reactivity.Map(
            () => items.Value,
            item =>
            {
                maps++;

                return LogCleanup(item, () => disposals++);
            }
        );

        var observer = Reactivity.Effect(() => mapped(), (_, _) => { });

        Reactivity.Flush();
        observer.Dispose();
        items.Value = ["b", "a"];
        Reactivity.Flush();

        expect.Equal("b,a", Join(mapped()), "the next read reconciles");
        expect.Equal(2, maps, "no item is mapped again");
        expect.Equal(0, disposals, "no item is disposed");
    }

    private static void MapThatDisposesItsOwnerLeavesNoItemAlive(IExpect expect)
    {
        var created = 0;
        var disposals = 0;
        var dispose = () => { };

        // Metano #843: an explicitly typed delegate local
        // loses its type in TS, so the map comes back from the root body instead.
        var mapped = Reactivity.Root(disposeRoot =>
        {
            dispose = disposeRoot;

            return Reactivity.Map<string, string>(
                () => ["a", "stop", "b"],
                item =>
                {
                    created++;

                    if (item == "stop")
                    {
                        dispose();
                    }

                    return LogCleanup(item, () => disposals++);
                }
            );
        });

        expect.Equal("a,stop,b", Join(mapped()), "the run completes");
        expect.Equal(3, created, "every item was mapped");
        expect.Equal(3, disposals, "every item owner is disposed when the run ends");
    }

    private static void CreatingAMapInAnApplyThrows(IExpect expect)
    {
        Exception? error = null;

        Reactivity.Effect(
            () => 0,
            (_, _) =>
                error = ScenarioRunner.Catch(() =>
                    Reactivity.Map<string, string>(() => [], item => item)
                )
        );

        Reactivity.Flush();

        expect.IsTrue(error is InvalidOperationException, "map in an apply throws");
    }

    private static void CleanupErrorRaisedInMapWaitsForTheNextFlush(IExpect expect)
    {
        var cleanupError = new InvalidOperationException("cleanup");

        var disposeInner = Reactivity.Root<Action>(disposeRoot =>
        {
            Reactivity.OnCleanup(() => throw cleanupError);

            return disposeRoot;
        });

        var mapped = Reactivity.Map<string, string>(
            () => ["a"],
            item =>
            {
                disposeInner();

                return item;
            }
        );

        var readError = ScenarioRunner.Catch(() => mapped());

        expect.IsTrue(readError is null, "the cleanup error does not abort the map run");
        expect.Equal("a", Join(mapped()), "the run completes");

        var flushError = ScenarioRunner.Catch(() => Reactivity.Flush());

        expect.IsTrue(ReferenceEquals(cleanupError, flushError), "the next flush rethrows it");
    }

    private static void KeyHashThatThrowsLeavesNoStaleIndexForTheNextRun(IExpect expect)
    {
        var log = "";
        var trap = new HashTrap();
        var a = new TrapKey("a", trap);
        var b = new TrapKey("b", trap);
        var items = Reactivity.Signal<IReadOnlyList<TrapKey>>([a, b]);

        var mapped = Reactivity.Map(
            () => items.Value,
            key => LogCleanup(key.Name, () => log += key.Name)
        );

        expect.Equal("a,b", Join(mapped()), "first read");

        trap.Armed = true;
        items.Value = [b, a];
        Reactivity.Flush();

        expect.IsTrue(
            ScenarioRunner.Catch(() => mapped()) is InvalidOperationException,
            "the hash error aborts the run"
        );

        trap.Armed = false;
        items.Value = [b];
        Reactivity.Flush();

        expect.Equal("b", Join(mapped()), "the next run reconciles against the committed keys");
        expect.Equal("a", log, "the removed item is disposed");
    }

    private static void EffectCreatedInMapRoutesItsErrorToTheBoundaryAboveTheMap(IExpect expect)
    {
        var errors = "";
        var disposals = "";
        var fail = Reactivity.Signal(false);
        var items = Reactivity.Signal<IReadOnlyList<string>>(["a", "b"]);

        Reactivity.ErrorBoundary(
            () =>
            {
                var mapped = Reactivity.Map(
                    () => items.Value,
                    item =>
                    {
                        Reactivity.OnCleanup(() => disposals += item);

                        Reactivity.Effect(
                            () =>
                                item == "b" && fail.Value
                                    ? throw new InvalidOperationException(item)
                                    : item,
                            (_, _) => { }
                        );

                        return item;
                    }
                );

                Reactivity.Effect(() => Join(mapped()), (_, _) => { });
            },
            error => errors += error.Message
        );

        Reactivity.Flush();
        fail.Value = true;
        Reactivity.Flush();

        expect.Equal("b", errors, "the boundary above the map handles the item effect's error");
        expect.Equal("", disposals, "every item stays alive");

        items.Value = ["a"];
        Reactivity.Flush();

        expect.Equal("b", disposals, "removing the failing item disposes its owner");
    }

    /// <summary>Registers <paramref name="cleanup" /> on the item owner and returns <paramref name="item" />.</summary>
    private static TItem LogCleanup<TItem>(TItem item, Action cleanup)
    {
        Reactivity.OnCleanup(cleanup);

        return item;
    }

    private static string Join<TItem>(IReadOnlyList<TItem> items)
    {
        var text = "";

        for (var index = 0; index < items.Count; index++)
        {
            text += (index == 0 ? "" : ",") + items[index];
        }

        return text;
    }

    private sealed record Row(int Id, string Name);

    /// <summary>Makes <see cref="TrapKey.GetHashCode" /> of the key named "b" throw while armed.</summary>
    private sealed class HashTrap
    {
        public bool Armed { get; set; }
    }

    /// <summary>A key equal by name whose hash can be made to throw (spec 4.8, aborted run).</summary>
    private sealed class TrapKey(string name, HashTrap trap) : IEquatable<TrapKey>
    {
        public string Name { get; } = name;

        public bool Equals(TrapKey? other) => other is not null && other.Name == Name;

        public override bool Equals(object? obj) => obj is TrapKey other && Equals(other);

        public override int GetHashCode() =>
            trap.Armed && Name == "b"
                ? throw new InvalidOperationException("hash")
                : Name.GetHashCode();
    }

    private sealed class Entry(int id, string name)
    {
        public int Id { get; } = id;

        public string Name { get; set; } = name;
    }
}
