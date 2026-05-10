import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/articles_provider.dart';
import '../providers/auth_provider.dart';
import '../models/article.dart';

class PublishScreen extends ConsumerStatefulWidget {
  final String articleId;

  const PublishScreen({super.key, required this.articleId});

  @override
  ConsumerState<PublishScreen> createState() => _PublishScreenState();
}

class _PublishScreenState extends ConsumerState<PublishScreen> {
  bool _publishing = false;
  Article? _published;

  Article? _article() {
    final articles = ref.read(articlesProvider);
    return articles.whenOrNull(
      data: (list) {
        try {
          return list.firstWhere((a) => a.id == widget.articleId);
        } catch (_) {
          return null;
        }
      },
    );
  }

  Future<void> _publish() async {
    final auth = ref.read(authProvider);
    if (!auth.user!.hasDevtoKey) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add your Dev.to API key in Settings first.')),
      );
      return;
    }

    setState(() => _publishing = true);
    try {
      final updated = await ref.read(articlesProvider.notifier).publish(widget.articleId);
      if (mounted) setState(() => _published = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
      }
    } finally {
      if (mounted) setState(() => _publishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final article = _article();

    return Scaffold(
      appBar: AppBar(title: const Text('Publish to Dev.to')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _published != null ? _buildSuccess() : _buildConfirm(article),
      ),
    );
  }

  Widget _buildConfirm(Article? article) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.upload_outlined, size: 64, color: Color(0xFF6750A4)),
        const SizedBox(height: 16),
        Text(
          'Publish Article',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        if (article != null) ...[
          Text(article.title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 6,
            children: article.tags.map((t) => Chip(label: Text('#$t'))).toList(),
          ),
        ],
        const SizedBox(height: 24),
        const Text(
          'This will publish the article to your Dev.to account. Make sure your API key is configured in Settings.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey),
        ),
        const Spacer(),
        FilledButton.icon(
          onPressed: _publishing ? null : _publish,
          icon: _publishing
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.upload),
          label: Text(_publishing ? 'Publishing…' : 'Publish Now'),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle_outline, size: 80, color: Colors.green),
        const SizedBox(height: 16),
        const Text('Published!', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(_published!.devtoUrl ?? '', textAlign: TextAlign.center, style: const TextStyle(color: Colors.blue)),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: _published!.devtoUrl ?? ''));
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('URL copied!')));
          },
          icon: const Icon(Icons.copy),
          label: const Text('Copy URL'),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
          child: const Text('Back to Home'),
        ),
      ],
    );
  }
}
