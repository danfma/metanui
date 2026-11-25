using Metano.Annotations;

namespace Metanui.Reactive.Graph;

#pragma warning disable CS0649 // fields are assigned by the dependency graph (Task 3)

/// <summary>
/// One dependency edge, member of two intrusive doubly linked lists: the subscriber's
/// dependencies (<see cref="PrevDep" />/<see cref="NextDep" />) and the dependency's
/// subscribers (<see cref="PrevSub" />/<see cref="NextSub" />).
/// </summary>
[Transpile]
internal sealed class Link(ReactiveNode dep, ReactiveNode sub)
{
    public int Version;
    public ReactiveNode Dep = dep;
    public ReactiveNode Sub = sub;
    public Link? PrevSub;
    public Link? NextSub;
    public Link? PrevDep;
    public Link? NextDep;
}
