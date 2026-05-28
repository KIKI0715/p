import 'package:cloud_firestore/cloud_firestore.dart';

class Message {
  final String id;
  final String conversationId;
  final String role;
  final String content;
  final DateTime createdAt;

  const Message({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    required this.createdAt,
  });

  factory Message.fromSnapshot(DocumentSnapshot doc, {String conversationId = ''}) {
    final data = doc.data() as Map<String, dynamic>;
    return Message(
      id: doc.id,
      conversationId: conversationId,
      role: data['role'] as String,
      content: data['content'] as String,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  // Legacy support — used by Cloud Function return values (plain Map)
  factory Message.fromMap(Map<String, dynamic> map, {String conversationId = ''}) {
    return Message(
      id: map['id'] as String? ?? '',
      conversationId: conversationId,
      role: map['role'] as String,
      content: map['content'] as String,
      createdAt: DateTime.now(),
    );
  }

  bool get isUser => role == 'user';
}
