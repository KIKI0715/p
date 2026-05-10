import 'message.dart';

class Conversation {
  final String id;
  final String title;
  final List<String> tags;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Message> messages;

  const Conversation({
    required this.id,
    required this.title,
    required this.tags,
    required this.createdAt,
    required this.updatedAt,
    this.messages = const [],
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['_id'] as String,
      title: json['title'] as String,
      tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      messages: (json['messages'] as List<dynamic>?)
              ?.map((m) => Message.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
