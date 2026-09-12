/// Deep equality for two serializations of the same JSON value.
///
/// Order-insensitive, and an absent key equals a present null. Both matter
/// because the values compared here are produced by two independent codecs for
/// one schema — the TypeScript rules on the server and the Dart twin on the
/// device — and a field that is optional and nullable may legitimately be
/// written either way. `{"yourMove": null}` and `{}` are the same observation
/// to anything that reads them, and treating them as different would report a
/// divergence between twins that agree. Neither JSON nor `jsonDecode` promises
/// key order either, and `==` on `Map` and `List` is identity.
///
/// It follows that this is equality of VALUES, not of documents: it cannot see
/// the difference between a field written as null and one left out, and must
/// not be used where that difference is the thing being checked.
bool jsonEquals(Object? a, Object? b) {
  if (identical(a, b)) return true;
  if (a is Map) {
    if (b is! Map) return false;
    for (final key in {...a.keys, ...b.keys}) {
      if (!jsonEquals(a[key], b[key])) return false;
    }
    return true;
  }
  if (b is Map) return false;
  if (a is List) {
    if (b is! List || a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!jsonEquals(a[i], b[i])) return false;
    }
    return true;
  }
  // Numbers survive a JSON round trip as `int` or `double` depending on how
  // they were written, so 1 and 1.0 are the same number here.
  if (a is num && b is num) return a == b;
  return a == b;
}
