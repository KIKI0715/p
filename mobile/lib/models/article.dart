import 'package:cloud_firestore/cloud_firestore.dart';

class Article {
  final String id;
  final String conversationId;
  final String title;
  final String content;
  final List<String> tags;
  final String status;
  final String? devtoUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Article({
    required this.id,
    required this.conversationId,
    required this.title,
    required this.content,
    required this.tags,
    required this.status,
    this.devtoUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Article.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Article(
      id: doc.id,
      conversationId: data['conversationId'] as String? ?? '',
      title: data['title'] as String,
      content: data['content'] as String,
      tags: (data['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      status: data['status'] as String? ?? 'draft',
      devtoUrl: data['devtoUrl'] as String?,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  // Used when Cloud Function returns the newly created/published article
  factory Article.fromMap(Map<String, dynamic> map) {
    return Article(
      id: map['id'] as String? ?? '',
      conversationId: map['conversationId'] as String? ?? '',
      title: map['title'] as String,
      content: map['content'] as String,
      tags: (map['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      status: map['status'] as String? ?? 'draft',
      devtoUrl: map['devtoUrl'] as String?,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  bool get isPublished => status == 'published';
}
