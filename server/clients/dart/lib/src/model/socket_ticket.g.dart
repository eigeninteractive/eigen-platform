// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'socket_ticket.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SocketTicket _$SocketTicketFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SocketTicket', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['ticket']);
      final val = SocketTicket(
        ticket: $checkedConvert('ticket', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SocketTicketToJson(SocketTicket instance) =>
    <String, dynamic>{'ticket': instance.ticket};
