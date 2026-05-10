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

  factory Article.fromJson(Map<String, dynamic> json) {
    return Article(
      id: json['_id'] as String,
      conversationId: json['conversationId'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      status: json['status'] as String,
      devtoUrl: json['devtoUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  bool get isPublished => status == 'published';
}
