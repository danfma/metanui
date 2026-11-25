namespace Metanui.Reactive.Graph;

/// <summary>
/// One dependency edge, member of two intrusive doubly linked lists: the subscriber's
/// dependencies (<see cref="PrevDep" />/<see cref="NextDep" />) and the dependency's
/// subscribers (<see cref="PrevSub" />/<see cref="NextSub" />).
/// </summary>
internal sealed class Link(
    int version,
    ReactiveNode dep,
    ReactiveNode sub,
    Link? prevDep,
    Link? nextDep,
    Link? prevSub
)
{
    public int Version = version;
    public ReactiveNode Dep = dep;
    public ReactiveNode Sub = sub;
    public Link? PrevSub = prevSub;
    public Link? NextSub;
    public Link? PrevDep = prevDep;
    public Link? NextDep = nextDep;
}
