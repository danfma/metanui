import { LinkStack } from "./link-stack.js";
import { Link } from "./link.js";
import { ReactiveFlags } from "./reactive-flags.js";
import type { ReactiveNode } from "./reactive-node.js";

export class DependencyGraph {
  private constructor() { }

  static link(dep: ReactiveNode, sub: ReactiveNode, version: number): void {
    const prevDep = sub.depsTail;

    if (prevDep != null && prevDep.dep === dep) {
      return;
    }

    const nextDep = prevDep != null ? prevDep.nextDep : sub.deps;

    if (nextDep != null && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;

      return;
    }

    const prevSub = dep.subsTail;

    if (prevSub != null && prevSub.version === version && prevSub.sub === sub) {
      return;
    }

    const newLink = new Link(version, dep, sub, prevDep, nextDep, prevSub);
    sub.depsTail = newLink;
    dep.subsTail = newLink;

    if (nextDep != null) {
      nextDep.prevDep = newLink;
    }

    if (prevDep != null) {
      prevDep.nextDep = newLink;
    } else {
      sub.deps = newLink;
    }

    if (prevSub != null) {
      prevSub.nextSub = newLink;
    } else {
      dep.subs = newLink;
    }
  }

  static unlink(link: Link, sub: ReactiveNode): Link | null {
    const dep = link.dep;
    const prevDep = link.prevDep;
    const nextDep = link.nextDep;
    const nextSub = link.nextSub;
    const prevSub = link.prevSub;

    if (nextDep != null) {
      nextDep.prevDep = prevDep;
    } else {
      sub.depsTail = prevDep;
    }

    if (prevDep != null) {
      prevDep.nextDep = nextDep;
    } else {
      sub.deps = nextDep;
    }

    if (nextSub != null) {
      nextSub.prevSub = prevSub;
    } else {
      dep.subsTail = prevSub;
    }

    if (prevSub != null) {
      prevSub.nextSub = nextSub;
    } else {
      dep.subs = nextSub;

      if (nextSub == null) {
        dep.unwatched();
      }
    }

    return nextDep;
  }

  static propagate(link: Link): void {
    const stackBase = LinkStack.top;
    try {
      DependencyGraph.propagateAbove(link, stackBase);
    } finally {
      LinkStack.truncate(stackBase);
    }
  }

  static checkDirty(link: Link, sub: ReactiveNode): boolean {
    const stackBase = LinkStack.top;
    try {
      return DependencyGraph.checkDirtyAbove(link, sub);
    } finally {
      LinkStack.truncate(stackBase);
    }
  }

  private static propagateAbove(link: Link, stackBase: number): void {
    let next: Link | null = link.nextSub;
    top: while (true) {
      const sub = link.sub;
      let flags = sub.flags;

      if ((flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending)) === 0) {
        sub.flags = flags | ReactiveFlags.Pending;
      } else if ((flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed)) === 0) {
        flags = ReactiveFlags.None;
      } else if ((flags & ReactiveFlags.RecursedCheck) === 0) {
        sub.flags = flags & ~ReactiveFlags.Recursed | ReactiveFlags.Pending;
      } else if ((flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) === 0 && DependencyGraph.isValidLink(link, sub)) {
        sub.flags = flags | ReactiveFlags.Recursed | ReactiveFlags.Pending;
        flags &= ReactiveFlags.Mutable;
      } else {
        flags = ReactiveFlags.None;
      }

      if ((flags & ReactiveFlags.Watching) !== 0) {
        sub.notify();
      }

      if ((flags & ReactiveFlags.Mutable) !== 0) {
        const subSubs = sub.subs;

        if (subSubs != null) {
          link = subSubs;
          const nextSub = subSubs.nextSub;

          if (nextSub != null) {
            LinkStack.push(next);
            next = nextSub;
          }

          continue;
        }
      }

      if (next != null) {
        link = next;
        next = link.nextSub;
        continue;
      }

      while (LinkStack.top > stackBase) {
        const popped = LinkStack.pop();

        if (popped != null) {
          link = popped;
          next = link.nextSub;
          continue top;
        }
      }
      break;
    }
  }

  private static checkDirtyAbove(link: Link, sub: ReactiveNode): boolean {
    let checkDepth = 0;
    let dirty = false;
    top: while (true) {
      const dep = link.dep;
      const flags = dep.flags;

      if ((sub.flags & ReactiveFlags.Dirty) !== 0) {
        dirty = true;
      } else if ((flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) === (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) {
        const subs = dep.subs!;

        if (dep.refresh()) {
          if (subs.nextSub != null) {
            DependencyGraph.shallowPropagate(subs);
          }

          dirty = true;
        }
      } else if ((flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) === (ReactiveFlags.Mutable | ReactiveFlags.Pending)) {
        LinkStack.push(link);
        link = dep.deps!;
        sub = dep;
        checkDepth = (checkDepth + 1) | 0;
        continue;
      }

      if (!dirty) {
        const nextDep = link.nextDep;

        if (nextDep != null) {
          link = nextDep;
          continue;
        }
      }

      while (checkDepth > 0) {
        checkDepth = (checkDepth - 1) | 0;
        link = LinkStack.pop()!;

        if (dirty) {
          const subs = sub.subs!;

          if (sub.refresh()) {
            if (subs.nextSub != null) {
              DependencyGraph.shallowPropagate(subs);
            }

            sub = link.sub;
            continue;
          }

          dirty = false;
        } else {
          sub.flags &= ~ReactiveFlags.Pending;
        }

        sub = link.sub;
        const nextDep = link.nextDep;

        if (nextDep != null) {
          link = nextDep;
          continue top;
        }
      }

      return dirty && sub.flags !== ReactiveFlags.None;
    }
  }

  static shallowPropagate(link: Link): void {
    let current: Link | null = link;
    do {
      const sub = current.sub;
      const flags = sub.flags;

      if ((flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) === ReactiveFlags.Pending) {
        sub.flags = flags | ReactiveFlags.Dirty;

        if ((flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck)) === ReactiveFlags.Watching) {
          sub.notify();
        }
      }

      current = current.nextSub;
    } while (current != null);
  }

  static purgeDeps(sub: ReactiveNode): void {
    const depsTail = sub.depsTail;
    let dep: Link | null = depsTail != null ? depsTail.nextDep : sub.deps;
    while (dep != null) {
      dep = DependencyGraph.unlink(dep, sub);
    }
  }

  static disposeAllDepsInReverse(sub: ReactiveNode): void {
    let link: Link | null = sub.depsTail;
    while (link != null) {
      const prev = link.prevDep;
      DependencyGraph.unlink(link, sub);
      link = prev;
    }
  }

  private static isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
    let link: Link | null = sub.depsTail;
    while (link != null) {
      if (link === checkLink) {
        return true;
      }

      link = link.prevDep;
    }

    return false;
  }
}
