import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/articles_provider.dart';
import '../models/article.dart';
import 'publish_screen.dart';

class ArticleEditorScreen extends ConsumerStatefulWidget {
  final String articleId;

  const ArticleEditorScreen({super.key, required this.articleId});

  @override
  ConsumerState<ArticleEditorScreen> createState() => _ArticleEditorScreenState();
}

class _ArticleEditorScreenState extends ConsumerState<ArticleEditorScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _dirty = false;
  bool _saving = false;
  Article? _article;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  void _load() {
    final articles = ref.read(articlesProvider);
    articles.whenData((list) {
      final a = list.firstWhere((a) => a.id == widget.articleId, orElse: () => throw StateError('not found'));
      setState(() {
        _article = a;
        _titleCtrl.text = a.title;
        _contentCtrl.text = a.content;
      });
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final updated = await ref.read(articlesProvider.notifier).update(
          widget.articleId,
          title: _titleCtrl.text.trim(),
          content: _contentCtrl.text,
        );
    if (mounted) {
      setState(() {
        _saving = false;
        _dirty = false;
        if (updated != null) _article = updated;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Article'),
        actions: [
          if (_dirty)
            IconButton(icon: const Icon(Icons.save), onPressed: _saving ? null : _save, tooltip: 'Save'),
          if (_article != null && !_article!.isPublished)
            FilledButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PublishScreen(articleId: widget.articleId)),
              ),
              icon: const Icon(Icons.upload),
              label: const Text('Publish'),
            ),
          if (_article?.isPublished == true)
            Chip(
              label: const Text('Published'),
              avatar: const Icon(Icons.public, size: 16),
              backgroundColor: Colors.green.withOpacity(0.1),
            ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Edit'),
            Tab(text: 'Preview'),
          ],
        ),
      ),
      body: _article == null
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                _buildEditor(),
                _buildPreview(),
              ],
            ),
    );
  }

  Widget _buildEditor() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Title',
              border: OutlineInputBorder(),
            ),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() => _dirty = true),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: TextField(
              controller: _contentCtrl,
              expands: true,
              maxLines: null,
              decoration: const InputDecoration(
                labelText: 'Content (Markdown)',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              onChanged: (_) => setState(() => _dirty = true),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    return Markdown(
      data: '# ${_titleCtrl.text}\n\n${_contentCtrl.text}',
      padding: const EdgeInsets.all(16),
    );
  }
}
