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

    final reply = await ref.read(conversationsProvider.notifier).sendMessage(widget.conversationId, text);
    if (mounted) {
      setState(() {
        if (reply != null) _messages = [..._messages, reply];
        _loading = false;
      });
      _scrollToBottom();
    }
  }

  Future<void> _generateArticle() async {
    setState(() => _generating = true);
    final result = await ref.read(conversationsProvider.notifier).generateArticle(widget.conversationId);
    if (!mounted) return;
    setState(() => _generating = false);

    if (result == null || result.containsKey('error')) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result?['error'] as String? ?? 'Generation failed')),
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
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.auto_awesome),
              label: const Text('Generate Article'),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty && !_loading
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.chat_bubble_outline, size: 56, color: Colors.grey),
                        const SizedBox(height: 12),
                        Text('Start chatting about your idea',
                            style: TextStyle(color: Colors.grey[600])),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _messages.length + (_loading ? 1 : 0),
                    itemBuilder: (ctx, i) {
                      if (i == _messages.length) {
                        return const Align(
                          alignment: Alignment.centerLeft,
                          child: Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              height: 24,
                              width: 48,
                              child: LinearProgressIndicator(),
                            ),
                          ),
                        );
                      }
                      return MessageBubble(message: _messages[i]);
                    },
                  ),
          ),
          const Divider(height: 1),
          Padding(
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
                      hintText: 'Ask anything…',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _loading ? null : _send,
                  icon: const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
