using Metano.Annotations;

namespace Metanui.Reactive.Graph;

// Port of alien-signals 3.2.1, stackblitz/alien-signals@8734d386d925025d0e99419bd9161c17b112c5ee:
// Link, Unlink, Propagate, CheckDirty, ShallowPropagate and IsValidLink follow src/system.ts line by
// line; PurgeDeps and DisposeAllDepsInReverse come from src/index.ts. The update/notify/unwatched
// callbacks of createReactiveSystem are the ReactiveNode members Update, Notify and Unwatched.
//
// Deviation: propagate drops its innerWrite parameter. Upstream sets it when a signal is written
// while an effect runs; here writes are deferred and propagation only starts from the flush, never
// inside a run, so it is always false.

/// <summary>Maintains the dependency links and moves the dirty state through them.</summary>
[Transpile]
internal static class DependencyGraph
{
    /// <summary>Records that <paramref name="sub" /> read <paramref name="dep" /> during the run stamped <paramref name="version" />.</summary>
    public static void Link(ReactiveNode dep, ReactiveNode sub, int version)
    {
        var prevDep = sub.DepsTail;

        if (prevDep is not null && prevDep.Dep == dep)
        {
            return;
        }

        var nextDep = prevDep is not null ? prevDep.NextDep : sub.Deps;

        if (nextDep is not null && nextDep.Dep == dep)
        {
            nextDep.Version = version;
            sub.DepsTail = nextDep;

            return;
        }

        var prevSub = dep.SubsTail;

        if (prevSub is not null && prevSub.Version == version && prevSub.Sub == sub)
        {
            return;
        }

        var newLink = new Link(version, dep, sub, prevDep, nextDep, prevSub);

        sub.DepsTail = newLink;
        dep.SubsTail = newLink;

        if (nextDep is not null)
        {
            nextDep.PrevDep = newLink;
        }

        if (prevDep is not null)
        {
            prevDep.NextDep = newLink;
        }
        else
        {
            sub.Deps = newLink;
        }

        if (prevSub is not null)
        {
            prevSub.NextSub = newLink;
        }
        else
        {
            dep.Subs = newLink;
        }
    }

    /// <summary>Removes <paramref name="link" /> from both lists and returns the next dependency of <paramref name="sub" />.</summary>
    public static Link? Unlink(Link link, ReactiveNode sub)
    {
        var dep = link.Dep;
        var prevDep = link.PrevDep;
        var nextDep = link.NextDep;
        var nextSub = link.NextSub;
        var prevSub = link.PrevSub;

        if (nextDep is not null)
        {
            nextDep.PrevDep = prevDep;
        }
        else
        {
            sub.DepsTail = prevDep;
        }

        if (prevDep is not null)
        {
            prevDep.NextDep = nextDep;
        }
        else
        {
            sub.Deps = nextDep;
        }

        if (nextSub is not null)
        {
            nextSub.PrevSub = prevSub;
        }
        else
        {
            dep.SubsTail = prevSub;
        }

        if (prevSub is not null)
        {
            prevSub.NextSub = nextSub;
        }
        else
        {
            dep.Subs = nextSub;

            if (nextSub is null)
            {
                dep.Unwatched();
            }
        }

        return nextDep;
    }

    /// <summary>Marks every subscriber reachable from <paramref name="link" /> as pending and notifies the watching ones.</summary>
    /// <remarks>
    /// The <c>finally</c> here and in <see cref="CheckDirty" /> is defensive: user code cannot throw out
    /// of a walk (Computed caches its errors, cleanups collect theirs), so only an engine or host error
    /// (a broken invariant, a JS <c>RangeError</c>) reaches it, and it keeps such an error from leaving
    /// stale frames under an enclosing walk. It costs nothing measurable on Bun
    /// (docs/design/0001-reactive-core-ts-audit.md).
    /// </remarks>
    public static void Propagate(Link link)
    {
        var stackBase = LinkStack.Top;

        try
        {
            PropagateAbove(link, stackBase);
        }
        finally
        {
            LinkStack.Truncate(stackBase);
        }
    }

    /// <summary>
    /// Walks the dependencies of a pending <paramref name="sub" />, recomputing the dirty ones, and
    /// reports whether <paramref name="sub" /> must recompute.
    /// </summary>
    public static bool CheckDirty(Link link, ReactiveNode sub)
    {
        var stackBase = LinkStack.Top;

        try
        {
            return CheckDirtyAbove(link, sub);
        }
        finally
        {
            LinkStack.Truncate(stackBase);
        }
    }

    private static void PropagateAbove(Link link, int stackBase)
    {
        var next = link.NextSub;

        while (true)
        {
            var sub = link.Sub;
            var flags = sub.Flags;

            if (
                (
                    flags
                    & (
                        ReactiveFlags.RecursedCheck
                        | ReactiveFlags.Recursed
                        | ReactiveFlags.Dirty
                        | ReactiveFlags.Pending
                    )
                ) == 0
            )
            {
                sub.Flags = flags | ReactiveFlags.Pending;
            }
            else if ((flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed)) == 0)
            {
                flags = ReactiveFlags.None;
            }
            else if ((flags & ReactiveFlags.RecursedCheck) == 0)
            {
                sub.Flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending;
            }
            else if (
                (flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) == 0
                && IsValidLink(link, sub)
            )
            {
                sub.Flags = flags | ReactiveFlags.Recursed | ReactiveFlags.Pending;
                flags &= ReactiveFlags.Mutable;
            }
            else
            {
                flags = ReactiveFlags.None;
            }

            if ((flags & ReactiveFlags.Watching) != 0)
            {
                sub.Notify();
            }

            if ((flags & ReactiveFlags.Mutable) != 0)
            {
                var subSubs = sub.Subs;

                if (subSubs is not null)
                {
                    link = subSubs;

                    var nextSub = subSubs.NextSub;

                    if (nextSub is not null)
                    {
                        LinkStack.Push(next);
                        next = nextSub;
                    }

                    continue;
                }
            }

            if (next is not null)
            {
                link = next;
                next = link.NextSub;

                continue;
            }

            // Metano #772: upstream pops with a labeled `continue top`, which Metano does not transpile.
            var resumed = LinkStack.PopNonNull(stackBase);

            if (resumed is null)
            {
                break;
            }

            link = resumed;
            next = link.NextSub;
        }
    }

    private static bool CheckDirtyAbove(Link link, ReactiveNode sub)
    {
        var checkDepth = 0;
        var dirty = false;

        while (true)
        {
            var dep = link.Dep;
            var flags = dep.Flags;

            if ((sub.Flags & ReactiveFlags.Dirty) != 0)
            {
                dirty = true;
            }
            else if (
                (flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty))
                == (ReactiveFlags.Mutable | ReactiveFlags.Dirty)
            )
            {
                var subs = dep.Subs!;

                if (dep.Update())
                {
                    if (subs.NextSub is not null)
                    {
                        ShallowPropagate(subs);
                    }

                    dirty = true;
                }
            }
            else if (
                (flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending))
                == (ReactiveFlags.Mutable | ReactiveFlags.Pending)
            )
            {
                LinkStack.Push(link);
                link = dep.Deps!;
                sub = dep;
                ++checkDepth;

                continue;
            }

            if (!dirty)
            {
                var nextDep = link.NextDep;

                if (nextDep is not null)
                {
                    link = nextDep;

                    continue;
                }
            }

            // Metano #772: labeled continue (C# 15) is not transpiled, so the upstream `continue top`
            // leaves this loop through `resumed`.
            var resumedAbove = false;

            while (checkDepth > 0)
            {
                // Upstream `while (checkDepth--)`.
                --checkDepth;
                link = LinkStack.Pop()!;

                if (dirty)
                {
                    var subs = sub.Subs!;

                    if (sub.Update())
                    {
                        if (subs.NextSub is not null)
                        {
                            ShallowPropagate(subs);
                        }

                        sub = link.Sub;

                        continue;
                    }

                    dirty = false;
                }
                else
                {
                    sub.Flags &= ~ReactiveFlags.Pending;
                }

                sub = link.Sub;

                var nextDep = link.NextDep;

                if (nextDep is not null)
                {
                    link = nextDep;
                    resumedAbove = true;

                    break;
                }
            }

            if (resumedAbove)
            {
                continue;
            }

            return dirty && sub.Flags != ReactiveFlags.None;
        }
    }

    /// <summary>Turns the pending subscribers of <paramref name="link" />'s list dirty, without going deeper.</summary>
    public static void ShallowPropagate(Link link)
    {
        // Metano #774: the `Link?` annotation of a local initialized from a non-null value is dropped,
        // so the TS local is typed `Link` and rejects the null end of the list; walk with a
        // non-null local and stop before stepping onto null.
        var current = link;

        while (true)
        {
            var sub = current.Sub;
            var flags = sub.Flags;

            if ((flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) == ReactiveFlags.Pending)
            {
                sub.Flags = flags | ReactiveFlags.Dirty;

                if (
                    (flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck))
                    == ReactiveFlags.Watching
                )
                {
                    sub.Notify();
                }
            }

            var nextSub = current.NextSub;

            if (nextSub is null)
            {
                return;
            }

            current = nextSub;
        }
    }

    /// <summary>Unlinks the dependencies of <paramref name="sub" /> that its last run did not read again.</summary>
    public static void PurgeDeps(ReactiveNode sub)
    {
        var depsTail = sub.DepsTail;
        var dep = depsTail is not null ? depsTail.NextDep : sub.Deps;

        while (dep is not null)
        {
            dep = Unlink(dep, sub);
        }
    }

    /// <summary>Unlinks every dependency of <paramref name="sub" />, last first.</summary>
    public static void DisposeAllDepsInReverse(ReactiveNode sub)
    {
        var link = sub.DepsTail;

        while (link is not null)
        {
            var prev = link.PrevDep;

            Unlink(link, sub);
            link = prev;
        }
    }

    private static bool IsValidLink(Link checkLink, ReactiveNode sub)
    {
        var link = sub.DepsTail;

        while (link is not null)
        {
            if (link == checkLink)
            {
                return true;
            }

            link = link.PrevDep;
        }

        return false;
    }
}
