import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

/// Deletes everything this device holds for [userId], its local games
/// included.
///
/// Account deletion only. Signing out keeps an account's replica, so signing
/// back in is instant and works offline (decision 0013); deleting the account
/// is the end of it, and the server's copies of its synchronized games are
/// anonymized by the same deletion that brought us here.
Future<void> deleteAccountData(Ref ref, String userId) async {
  final database = await ref.read(replicaDatabaseProvider.future);
  await AccountReplica(database, userId).deleteAll();
}

/// Drops what the server stated for a guest account being abandoned for an
/// existing one.
///
/// The guest's local games stay: they are the device's own, and nothing about
/// switching accounts is a decision to discard them.
Future<void> forgetAbandonedGuest(Ref ref, String guestId) async {
  final database = await ref.read(replicaDatabaseProvider.future);
  await AccountReplica(database, guestId).resetReplicated();
}
