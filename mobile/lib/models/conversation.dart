import 'package:cloud_firestore/cloud_firestore.dart';
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

  factory Conversation.fromSnapshot(DocumentSnapshot doc, {List<Message> messages = const []}) {
    final data = doc.data() as Map<String, dynamic>;
    return Conversation(
      id: doc.id,
      title: data['title'] as String,
      tags: (data['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      messages: messages,
    );
  }
}
