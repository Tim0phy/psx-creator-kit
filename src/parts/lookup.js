// Safe dynamic builder lookup (CodeQL js/unvalidated-dynamic-method-call).
//
// Item ids reach the part builders from URL params (?top=...), imported JSON
// files and localStorage, so a bare `BUILDERS[id]` lookup may resolve to an
// inherited Object.prototype member (constructor, hasOwnProperty, __proto__,
// ...) and calling the result can throw a TypeError. Resolve a builder only
// when `id` is an OWN property of the map AND the value is a function;
// otherwise return null and let the caller fall back.
export function resolveBuilder(map, id) {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(map, id))
    return null;
  const fn = map[id];
  return typeof fn === "function" ? fn : null;
}
