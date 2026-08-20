//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'socket_ticket.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SocketTicket {
  /// Returns a new [SocketTicket] instance.
  SocketTicket({required this.ticket});

  @JsonKey(name: r'ticket', required: true, includeIfNull: false)
  final String ticket;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is SocketTicket && other.ticket == ticket;

  @override
  int get hashCode => ticket.hashCode;

  factory SocketTicket.fromJson(Map<String, dynamic> json) =>
      _$SocketTicketFromJson(json);

  Map<String, dynamic> toJson() => _$SocketTicketToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
