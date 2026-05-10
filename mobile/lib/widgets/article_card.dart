import 'package:flutter/material.dart';
import '../models/article.dart';

class ArticleCard extends StatelessWidget {
  final Article article;
  final VoidCallback onTap;
  final VoidCallback? onDelete;

  const ArticleCard({
    super.key,
    required this.article,
    required this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: article.isPublished
              ? Colors.green.withOpacity(0.15)
              : Theme.of(context).colorScheme.primaryContainer,
          child: Icon(
            article.isPublished ? Icons.public : Icons.edit_note,
            color: article.isPublished ? Colors.green : Theme.of(context).colorScheme.primary,
          ),
        ),
        title: Text(article.title, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Wrap(
          spacing: 4,
          children: [
            Chip(
              label: Text(article.isPublished ? 'Published' : 'Draft', style: const TextStyle(fontSize: 11)),
              padding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
              backgroundColor: article.isPublished ? Colors.green.withOpacity(0.1) : null,
            ),
            ...article.tags.take(2).map(
                  (tag) => Chip(
                    label: Text('#$tag', style: const TextStyle(fontSize: 11)),
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
          ],
        ),
        trailing: onDelete != null
            ? IconButton(
                icon: const Icon(Icons.delete_outline),
                onPressed: onDelete,
              )
            : null,
      ),
    );
  }
}
