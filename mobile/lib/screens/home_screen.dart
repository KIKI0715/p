import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../providers/conversations_provider.dart';
import '../providers/articles_provider.dart';
import '../models/conversation.dart';
import '../models/article.dart';
import '../widgets/article_card.dart';
import 'chat_screen.dart';
import 'article_editor_screen.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _newConversation() async {
    final titleCtrl = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Conversation'),
        content: TextField(
          controller: titleCtrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Conversation title…'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, titleCtrl.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (title == null || title.isEmpty) return;
    final conv = await ref.read(conversationsProvider.notifier).create(title, []);
    if (conv != null && mounted) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => ChatScreen(conversationId: conv.id, title: conv.title)));
    }
  }

  Future<void> _deleteConversation(String id) async {
    await ref.read(conversationsProvider.notifier).delete(id);
  }

  Future<void> _deleteArticle(String id) async {
    await ref.read(articlesProvider.notifier).delete(id);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final conversations = ref.watch(conversationsProvider);
    final articles = ref.watch(articlesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${auth.user?.name ?? ''}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(icon: Icon(Icons.chat_bubble_outline), text: 'Conversations'),
            Tab(icon: Icon(Icons.article_outlined), text: 'Articles'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _buildConversationsList(conversations),
          _buildArticlesList(articles),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newConversation,
        icon: const Icon(Icons.add),
        label: const Text('New Chat'),
      ),
    );
  }

  Widget _buildConversationsList(AsyncValue<List<Conversation>> state) {
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (list) => list.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.chat_bubble_outline, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No conversations yet.\nTap + to start chatting.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => ref.read(conversationsProvider.notifier).load(),
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: list.length,
                itemBuilder: (ctx, i) {
                  final c = list[i];
                  return Dismissible(
                    key: Key(c.id),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 16),
                      color: Colors.red,
                      child: const Icon(Icons.delete, color: Colors.white),
                    ),
                    onDismissed: (_) => _deleteConversation(c.id),
                    child: ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.chat_bubble_outline)),
                      title: Text(c.title),
                      subtitle: Text('${c.tags.isEmpty ? '' : c.tags.map((t) => '#$t').join(' ')}', style: const TextStyle(fontSize: 12)),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => ChatScreen(conversationId: c.id, title: c.title)),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }

  Widget _buildArticlesList(AsyncValue<List<Article>> state) {
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (list) => list.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.article_outlined, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No articles yet.\nGenerate one from a conversation.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => ref.read(articlesProvider.notifier).load(),
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: list.length,
                itemBuilder: (ctx, i) {
                  final a = list[i];
                  return ArticleCard(
                    article: a,
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => ArticleEditorScreen(articleId: a.id)),
                    ),
                    onDelete: () => _deleteArticle(a.id),
                  );
                },
              ),
            ),
    );
  }
}
