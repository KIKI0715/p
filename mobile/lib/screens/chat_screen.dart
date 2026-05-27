import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/message.dart';
import '../providers/conversations_provider.dart';
import '../providers/articles_provider.dart';
import '../widgets/message_bubble.dart';
import 'article_editor_screen.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String title;

  const ChatScreen({super.key, required this.conversationId, required this.title});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<Message> _messages = [];
  bool _loading = false;
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    final conv = await ref.read(conversationsProvider.notifier).getWithMessages(widget.conversationId);
    if (conv != null && mounted) {
      setState(() => _messages = conv.messages);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty || _loading) return;
    _inputCtrl.clear();

    final userMsg = Message(
      id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
      conversationId: widget.conversationId,
      role: 'user',
      content: text,
      createdAt: DateTime.now(),
    );
    setState(() {
      _messages = [..._messages, userMsg];
      _loading = true;
    });
    _scrollToBottom();

    try {
      final reply = await ref
          .read(conversationsProvider.notifier)
          .sendMessage(widget.conversationId, text);
      if (mounted) {
        setState(() {
          _messages = [..._messages, reply];
          _loading = false;
        });
        _scrollToBottom();
      }
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((m) => m.id != userMsg.id).toList();
        _loading = false;
      });
      _inputCtrl.text = text;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Claude 응답 실패: ${e.message ?? e.code}'),
          backgroundColor: Theme.of(context).colorScheme.error,
          action: SnackBarAction(label: '다시 시도', textColor: Colors.white, onPressed: _send),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((m) => m.id != userMsg.id).toList();
        _loading = false;
      });
      _inputCtrl.text = text;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('오류: $e'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _generateArticle() async {
    setState(() => _generating = true);
    final result = await ref
        .read(conversationsProvider.notifier)
        .generateArticle(widget.conversationId);
    if (!mounted) return;
    setState(() => _generating = false);

    if (result == null || result.containsKey('error')) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result?['error'] as String? ?? '생성 실패')),
      );
      return;
    }

    await ref.read(articlesProvider.notifier).load();
    final articleId = result['id'] as String?;
    if (articleId != null && mounted) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ArticleEditorScreen(articleId: articleId)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, overflow: TextOverflow.ellipsis),
        actions: [
          if (_messages.isNotEmpty)
            TextButton.icon(
              onPressed: _generating ? null : _generateArticle,
              icon: _generating
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome),
              label: const Text('글로 만들기'),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty && !_loading
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    itemCount: _messages.length + (_loading ? 1 : 0),
                    itemBuilder: (ctx, i) {
                      if (i == _messages.length) return const TypingIndicator();
                      return MessageBubble(message: _messages[i]);
                    },
                  ),
          ),
          const Divider(height: 1),
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.auto_awesome,
                size: 36,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Claude와 대화를 시작하세요',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '오늘 있었던 일, 생각, 감정 무엇이든 이야기해 보세요.\n대화가 끝나면 글로 정리해 드립니다.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600], height: 1.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInput() {
    return Padding(
      padding: EdgeInsets.only(
        left: 12,
        right: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 8,
        top: 8,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _inputCtrl,
              minLines: 1,
              maxLines: 5,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: '무슨 생각을 하고 있나요?',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: _loading ? null : _send,
            icon: const Icon(Icons.send),
          ),
        ],
      ),
    );
  }
}
