import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'rng_fixtures.dart';

/// One recorded stream: `(seed, version)` for a transition, plus a seat when
/// the stream is a bot's.
typedef _Vector = ({
  String name,
  String seed,
  int version,
  int? seat,
  List<double> draws,
});

/// Draws taken from the installed rand-seed 3.0.0 through the kernel's own
/// derivation, with:
///
/// ```sh
/// node -e 'import("<server>/node_modules/.pnpm/rand-seed@3.0.0/node_modules/rand-seed/dist/es/index.js")
///   .then(m => { const r = new m.default("abc:0");
///     console.log([...Array(16)].map(() => r.next())); })'
/// ```
///
/// A transition stream is keyed `"<seed>:<version>"` and a bot stream
/// `"<seed>:bot<seat>:<version>"`, which is what the Durable Object derives
/// when it wakes a seated bot. The cases cover an empty seed, a seed outside
/// the basic multilingual plane (the hash walks UTF-16 code units, so the
/// surrogate pair has to hash the same on both sides), and versions 0, 1 and
/// 1000.
const _vectors = <_Vector>[
  (
    name: "transition zero",
    seed: "abc",
    version: 0,
    seat: null,
    draws: <double>[
      0.7555201658979058,
      0.23458926379680634,
      0.20840011001564562,
      0.8998004239983857,
      0.12814509379677474,
      0.2472655123565346,
      0.8512272185180336,
      0.9678537603467703,
      0.8509890118148178,
      0.4933607846032828,
      0.74180309753865,
      0.35278857755474746,
      0.4586265610996634,
      0.26562118786387146,
      0.6947959261015058,
      0.29484999482519925,
    ],
  ),
  (
    name: "transition one",
    seed: "abc",
    version: 1,
    seat: null,
    draws: <double>[
      0.652877781772986,
      0.3348495189566165,
      0.40852857986465096,
      0.7198019118513912,
      0.5444345560390502,
      0.817017201334238,
      0.4074700258206576,
      0.8246429145801812,
      0.8872734382748604,
      0.7382860076613724,
      0.013186418218538165,
      0.22379877720959485,
      0.11611403618007898,
      0.6761262950021774,
      0.8007925290148705,
      0.04317522281780839,
    ],
  ),
  (
    name: "transition one thousand",
    seed: "0123456789abcdef0123456789abcdef",
    version: 1000,
    seat: null,
    draws: <double>[
      0.12232013163156807,
      0.2644179111812264,
      0.054102192632853985,
      0.8982897293753922,
      0.8914853688329458,
      0.04672349081374705,
      0.768395584076643,
      0.085669313557446,
      0.8173074931837618,
      0.09982628654688597,
      0.09558170032687485,
      0.3845170771237463,
      0.21867898711934686,
      0.5418187947943807,
      0.11917890678159893,
      0.6482209507375956,
    ],
  ),
  (
    name: "empty seed",
    seed: "",
    version: 0,
    seat: null,
    draws: <double>[
      0.5250965030863881,
      0.09899913612753153,
      0.29597814311273396,
      0.4625479921232909,
      0.005270073190331459,
      0.9501294987276196,
      0.2530236756429076,
      0.7905326830223203,
      0.6155264165718108,
      0.04966213880106807,
      0.3463163252454251,
      0.8802959225140512,
      0.2092125138733536,
      0.6366239341441542,
      0.33535204315558076,
      0.1364544816315174,
    ],
  ),
  (
    name: "astral and accented seed",
    seed: "félicité🎲平仮名",
    version: 7,
    seat: null,
    draws: <double>[
      0.5039876338560134,
      0.4456937089562416,
      0.37709132861346006,
      0.7214846150018275,
      0.7971002892591059,
      0.5163013965357095,
      0.5433008964173496,
      0.6082854839041829,
      0.40743502345867455,
      0.14026961009949446,
      0.45145078329369426,
      0.8788708979263902,
      0.17132450570352376,
      0.8898665267042816,
      0.24571476900018752,
      0.4960218195337802,
    ],
  ),
  (
    name: "bot stream seat zero",
    seed: "abc",
    version: 0,
    seat: 0,
    draws: <double>[
      0.5776016779709607,
      0.2007104007061571,
      0.6647806016262621,
      0.07085979823023081,
      0.5793079049326479,
      0.26808766508474946,
      0.0859179007820785,
      0.783983089029789,
      0.8112717550247908,
      0.5069589836057276,
      0.38262113207019866,
      0.9682852521073073,
      0.41253650514408946,
      0.8472885561641306,
      0.22237568721175194,
      0.7007070404943079,
    ],
  ),
  (
    name: "bot stream seat one",
    seed: "abc",
    version: 1,
    seat: 1,
    draws: <double>[
      0.041107065975666046,
      0.46530418610200286,
      0.21421327162533998,
      0.884577038930729,
      0.012653443729504943,
      0.8191810226999223,
      0.3018255028873682,
      0.4283802236896008,
      0.8829993521794677,
      0.2737128562293947,
      0.9802371843252331,
      0.8075580585282296,
      0.1681779425125569,
      0.5349689775612205,
      0.08381325495429337,
      0.7578082156833261,
    ],
  ),
  (
    name: "bot stream high seat",
    seed: "félicité🎲平仮名",
    version: 1000,
    seat: 12,
    draws: <double>[
      0.33702226425521076,
      0.6294075245968997,
      0.07037670956924558,
      0.4063161404337734,
      0.9697722913697362,
      0.14131850935518742,
      0.10998835042119026,
      0.18443578225560486,
      0.058852319372817874,
      0.21071410132572055,
      0.7934179303701967,
      0.06802549073472619,
      0.15102173504419625,
      0.5024964220356196,
      0.2655732498969883,
      0.010330182267352939,
    ],
  ),
];

EigenRng _open(String seed, int version, int? seat) => seat == null
    ? EigenRng.forTransition(seed, version)
    : EigenRng.forBot(seed, seat, version);

void main() {
  group('EigenRng', () {
    for (final vector in _vectors) {
      test('reproduces rand-seed for ${vector.name}', () {
        final rng = _open(vector.seed, vector.version, vector.seat);
        final drawn = [
          for (var i = 0; i < vector.draws.length; i++) rng.next(),
        ];

        // Exact equality, deliberately: the server replays an imported local
        // game through the TypeScript rules, so a draw that is merely close
        // desynchronizes the two copies one transition later.
        expect(drawn, orderedEquals(vector.draws));
      });
    }

    test('draws stay inside [0, 1)', () {
      final rng = EigenRng.forTransition('bounds', 3);
      for (var index = 0; index < 512; index++) {
        final draw = rng.next();
        expect(draw, greaterThanOrEqualTo(0));
        expect(draw, lessThan(1));
      }
    });

    test('the same key replays and different keys diverge', () {
      double first(EigenRng rng) => rng.next();

      expect(
        first(EigenRng.forTransition('seed', 3)),
        first(EigenRng.forTransition('seed', 3)),
      );
      expect(
        first(EigenRng.forTransition('seed', 3)),
        isNot(first(EigenRng.forTransition('seed', 4))),
      );
      expect(
        first(EigenRng.forTransition('seed', 3)),
        isNot(first(EigenRng.forTransition('other', 3))),
      );
      // A bot stream is a different stream from its transition's, so a brain
      // drawing cannot consume the transition's randomness.
      expect(
        first(EigenRng.forTransition('seed', 3)),
        isNot(first(EigenRng.forBot('seed', 0, 3))),
      );
      expect(
        first(EigenRng.forBot('seed', 0, 3)),
        isNot(first(EigenRng.forBot('seed', 1, 3))),
      );
    });

    test('matches every generated rng fixture case', () {
      final cases = loadRngFixtureCases();
      if (cases == null) {
        // Either the browser, which has no file system, or a checkout where
        // the testkit has not emitted the file yet.
        return;
      }
      for (final entry in cases) {
        final draws = (entry['draws'] as List<dynamic>).cast<num>();
        final rng = _open(
          entry['seed'] as String,
          entry['version'] as int,
          entry['seat'] as int?,
        );
        expect(
          [for (var index = 0; index < draws.length; index++) rng.next()],
          orderedEquals([for (final draw in draws) draw.toDouble()]),
          reason: 'rng fixture "${entry['name']}"',
        );
      }
    });
  });
}
