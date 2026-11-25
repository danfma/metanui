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
    /// of a walk (Computed caches its errors, cleanups collect theirs). An engine or host error (a
    /// broken invariant, a JS <c>RangeError</c>) may reach it, and then it keeps that error from leaving
    /// stale frames under an enclosing walk; that path is untested. Its cost is within noise on
    /// JavaScriptCore (Bun), under 0.05 ns per call; V8 is not measured
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

        top:
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

            while (LinkStack.Top > stackBase)
            {
                var popped = LinkStack.Pop();

                if (popped is not null)
                {
                    link = popped;
                    next = link.NextSub;

                    continue top;
                }
            }

            break;
        }
    }

    private static bool CheckDirtyAbove(Link link, ReactiveNode sub)
    {
        var checkDepth = 0;
        var dirty = false;

        top:
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

                    continue top;
                }
            }

            return dirty && sub.Flags != ReactiveFlags.None;
        }
    }

    /// <summary>Turns the pending subscribers of <paramref name="link" />'s list dirty, without going deeper.</summary>
    public static void ShallowPropagate(Link link)
    {
        // Metano: a `var` local keeps the type of its non-null initializer in TS and rejects the
        // later null assignment (TS2322), so the nullable type is spelled out.
        Link? current = link;

        while (current is not null)
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

            current = current.NextSub;
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
