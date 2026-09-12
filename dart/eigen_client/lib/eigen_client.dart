/// Pure Dart runtime APIs for EigenInteractive clients.
library;

export 'package:eigen_api/eigen_api.dart'
    show
        Bot,
        BotType,
        CommandAccepted,
        Created,
        ErrorCode,
        Frame,
        FrameTypeEnum,
        Friend,
        FriendRequest,
        FriendRequestDirectionEnum,
        FriendRequestResultStatusEnum,
        GameAccess,
        GameOrigin,
        GameStatus,
        GameSummary,
        LocalRecord,
        LocalRejection,
        LocalTransition,
        LocalTransitionKindEnum,
        LocalTransitionRow,
        LocalTransitions,
        LocalTransitionsApplied,
        Outcome,
        OutcomeResultEnum,
        Player,
        Profile,
        Rating,
        RatingDelta,
        RatingHistoryEntry,
        RatingIdentity,
        Seat,
        SeatTypeEnum,
        Session,
        SoloStarted,
        TransitionAction,
        TransitionActionKindEnum,
        TransitionActionTypeEnum;

export 'src/api/access_token_provider.dart';
export 'src/api/avatar_url.dart';
export 'src/api/engine_call.dart';
export 'src/api/eigen_client_runtime.dart';
export 'src/api/engine_exception.dart';
export 'src/api/game_socket.dart';
export 'src/api/games_page.dart';
export 'src/api/server_clock.dart';
export 'src/domain/game_creation_spec.dart';
export 'src/domain/game_frame.dart';
export 'src/domain/game_player.dart';
export 'src/domain/game_session.dart';
export 'src/domain/game_transition.dart';
export 'src/domain/my_seat.dart';
export 'src/domain/players_context.dart';
export 'src/domain/timing_context.dart';

// ── Local play ─────────────────────────────────────────────────────────────
//
// Offline play against on-device bots (architecture decision 0012): the Dart
// twin of the authoritative TypeScript rules contract, a port of the kernel's
// `commit()` for an untimed local game, and the engine that drives one. Pure
// Dart like the rest of this package: a Flutter adapter supplies the store and
// the isolate bot runner above it.
export 'src/local/bot_runner.dart';
export 'src/local/json_equals.dart';
export 'src/local/local_game.dart';
export 'src/local/local_game_engine.dart';
export 'src/local/local_game_import.dart';
export 'src/local/local_game_store.dart';
export 'src/local/local_game_sync.dart';
export 'src/local/local_kernel.dart';
export 'src/local/local_rules.dart';
export 'src/local/local_session.dart';
export 'src/local/rng.dart';
export 'src/repositories/avatar_storage_service.dart';
export 'src/repositories/device_repository.dart';
export 'src/repositories/game_repository.dart';
export 'src/repositories/player_batch_loader.dart';
export 'src/repositories/player_repository.dart';
export 'src/repositories/profile_repository.dart';
export 'src/repositories/rating_repository.dart';
export 'src/repositories/social_repository.dart';
