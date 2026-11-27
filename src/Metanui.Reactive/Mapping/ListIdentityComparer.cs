namespace Metanui.Reactive.Mapping;

/// <summary>
/// Compares result lists by reference, so a <see cref="KeyedMap{T, TKey, TResult}" /> notifies its
/// observers exactly when it returns a new list (spec 4.8). The default comparer would compare the
/// elements on TS (spec 4.1).
/// </summary>
internal sealed class ListIdentityComparer<TResult> : IEqualityComparer<IReadOnlyList<TResult>>
{
    public bool Equals(IReadOnlyList<TResult>? x, IReadOnlyList<TResult>? y) =>
        ReferenceEquals(x, y);

    /// <summary>
    /// Never called by a computed. The list's own hash is consistent with reference equality (the
    /// same instance hashes the same); JavaScript has no identity hash for
    /// <c>RuntimeHelpers.GetHashCode</c>.
    /// </summary>
    public int GetHashCode(IReadOnlyList<TResult> list) => list.GetHashCode();
}
