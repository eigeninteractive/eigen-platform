import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../repositories/avatar_storage_service.dart';
import '../repositories/device_repository.dart';
import '../repositories/game_repository.dart';
import '../repositories/player_repository.dart';
import '../repositories/profile_repository.dart';
import '../repositories/rating_repository.dart';
import '../repositories/social_repository.dart';
import 'engine_call.dart';
import 'game_socket.dart';

/// A configured EigenInteractive backend.
///
/// The caller owns [http], including authentication, retry, timeouts, and
/// lifecycle. This runtime owns the generated HTTP resources and socket-ticket
/// exchange so presentation packages never need to depend on generated API
/// classes.
class EigenClient {
  factory EigenClient({required Dio http, required String baseUrl}) {
    final gamesApi = GamesApi(http);
    final socket = GameSocket(
      baseUrl: baseUrl,
      ticketProvider: (gameId) async {
        final response = await engineData(
          () => gamesApi.createSocketTicket(gameId: gameId),
        );
        return response.ticket;
      },
    );
    return EigenClient._(
      games: GameRepository(http, socket),
      social: SocialRepository(http),
      profile: ProfileRepository(http),
      avatar: AvatarStorageService(http),
      devices: DeviceRepository(http),
      ratings: RatingRepository(http),
      players: PlayerRepository(http),
    );
  }

  const EigenClient._({
    required this.games,
    required this.social,
    required this.profile,
    required this.avatar,
    required this.devices,
    required this.ratings,
    required this.players,
  });

  /// Discovery, lifecycle commands, play, replay, and live sessions.
  final GameRepository games;

  /// Friends, requests, blocks, user search, and friends' games.
  final SocialRepository social;

  /// The authenticated user's profile and account lifecycle.
  final ProfileRepository profile;

  /// The authenticated user's avatar upload endpoint.
  final AvatarStorageService avatar;

  /// Push registrations for the authenticated user's installations.
  final DeviceRepository devices;

  /// Public and authenticated rating reads.
  final RatingRepository ratings;

  /// Batched public player identity reads.
  final PlayerRepository players;
}
