import 'local_rules.dart';

/// Everything is reduced to 32 unsigned bits after every step, because that is
/// the only width both runtimes agree on: on the Dart VM an `int` is 64 bits
/// and on the web it is a JavaScript number, where the bitwise operators are
/// defined on 32 bits.
const int _mask32 = 0xFFFFFFFF;

/// The low 32 bits of `a * b`: the port of JavaScript's `Math.imul`.
///
/// A plain `a * b` would need 64 exact bits, which the web does not have (a
/// JavaScript number is exact only to 53 bits), so the product is assembled
/// from 16-bit halves: each partial product stays below 2^32 and their sum
/// below 2^33, well inside what a double represents exactly. Only the low 16
/// bits of the cross terms can reach the result, so they are masked before the
/// shift.
int _mul32(int a, int b) {
  final aLow = a & 0xFFFF;
  final aHigh = (a >>> 16) & 0xFFFF;
  final bLow = b & 0xFFFF;
  final bHigh = (b >>> 16) & 0xFFFF;
  final cross = ((aLow * bHigh + aHigh * bLow) & 0xFFFF) << 16;
  return (aLow * bLow + cross) & _mask32;
}

/// `value << bits` reduced to 32 unsigned bits.
///
/// The mask is what makes the two runtimes agree: the VM shifts in full
/// precision and dart2js already truncates, so the result is identical only
/// once both are reduced.
int _shl32(int value, int bits) => (value << bits) & _mask32;

/// rand-seed's `_xfnv1a`: an FNV-1a variant over the seed string, whose
/// closure is drawn from four times to key sfc32.
///
/// The mutable state persists across draws, exactly like the closed-over `t`
/// in the JavaScript original, and that is load-bearing: the four words are
/// four successive scrambles of one hash, not four hashes.
final class _Fnv1a {
  _Fnv1a(String key) {
    var hash = 2166136261;
    for (var index = 0; index < key.length; index++) {
      // UTF-16 code units, because `String.prototype.charCodeAt` is defined on
      // them; `codeUnitAt` is Dart's identical operation, and a seed outside
      // the basic plane hashes through its surrogate pair on both sides.
      hash = _mul32(hash ^ key.codeUnitAt(index), 16777619);
    }
    _state = hash;
  }

  late int _state;

  int next() {
    // The JavaScript original lets the additions grow past 32 bits and relies
    // on the next bitwise operator to reduce them. Reducing at every step is
    // the same value, because addition commutes with the modulo.
    var value = _state;
    value = (value + _shl32(value, 13)) & _mask32;
    value ^= value >>> 7;
    value = (value + _shl32(value, 3)) & _mask32;
    value ^= value >>> 17;
    value = (value + _shl32(value, 5)) & _mask32;
    _state = value;
    return value;
  }
}

/// The engine's deterministic random stream, ported bit for bit from the
/// kernel's `deriveRng` in `server/packages/kernel/src/rng.ts`.
///
/// The server derives a transition's stream as rand-seed 3.0.0's default
/// generator (sfc32) keyed by `"<seed>:<version>"`, and a bot's as
/// `"<seed>:bot<seat>:<version>"`. A local game is replayed by the
/// authoritative TypeScript rules when it is imported, so a draw that differs
/// by one bit produces a different game on the server than the one the player
/// watched: this port is required to be exact, not close, and
/// `test/local/rng_test.dart` pins it against vectors taken from the installed
/// npm package on both the VM and a browser.
final class EigenRng implements Rng {
  EigenRng._(String key) {
    final hash = _Fnv1a(key);
    _a = hash.next();
    _b = hash.next();
    _c = hash.next();
    _d = hash.next();
  }

  /// The stream for the transition committing as [version] in the game whose
  /// base seed is [seed]: the twin of `deriveRng(seed, version)`.
  factory EigenRng.forTransition(String seed, int version) =>
      EigenRng._('$seed:$version');

  /// The stream keyed by [seed] exactly as given: the twin of rand-seed's own
  /// `new Rand(seed)`.
  ///
  /// The two factories above are what a game ever uses, because every real
  /// stream is derived. This one exists for the standalone hook cases in the
  /// shared twin fixtures, which have no version to derive from and so name
  /// their stream directly.
  factory EigenRng.forSeed(String seed) => EigenRng._(seed);

  /// The stream one bot brain draws from at [seat] when acting on the state at
  /// [version]: the twin of the Durable Object's
  /// `deriveRng("${seed}:bot${seat}", version)`, which is drawn from the
  /// version the bot's move is committed against, not the one it produces.
  factory EigenRng.forBot(String seed, int seat, int version) =>
      EigenRng._('$seed:bot$seat:$version');

  late int _a;
  late int _b;
  late int _c;
  late int _d;

  @override
  double next() {
    final result = (((_a + _b) & _mask32) + _d) & _mask32;
    final b = _b;
    final c = _c;
    _a = b ^ (b >>> 9);
    _b = (c + _shl32(c, 3)) & _mask32;
    _c = ((_shl32(c, 21) | (c >>> 11)) + result) & _mask32;
    _d = (_d + 1) & _mask32;
    // 2^32 is a power of two and the numerator is an exact integer below it,
    // so the quotient is the same double everywhere.
    return result / 4294967296;
  }
}
