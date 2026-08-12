import 'package:eigen_api/eigen_api.dart';

/// One page of a paged game list, plus the token that continues it.
///
/// [nextCursor] is opaque: it comes from the server and goes back to the server
/// unread. That is the point of it. The previous design sent the sort value of
/// the last row, which meant every screen that paged had to know how the server
/// sorted that particular list - that finished games order by their finish time
/// and fall back to their last update, while active ones order by their last
/// update. Two copies of a rule the server owns, kept in sync by hand.
///
/// [nextCursor] being null is an *answer*: the server has told us this is the
/// end of the list. The screens used to infer that from a page coming back
/// shorter than the page size, which is a guess, and it is wrong exactly when
/// the final page happens to be full - the reader then sees a spinner and one
/// pointless request that returns nothing.
typedef GamesPage = ({List<GameSummary> games, String? nextCursor});
