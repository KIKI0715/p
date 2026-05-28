import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';
import '../models/message.dart';
import '../providers/diaries_provider.dart';
import '../widgets/message_bubble.dart';
import 'diary_view_screen.dart';

class DiaryChatScreen extends ConsumerStatefulWidget {
  final String diaryId;
  const DiaryChatScreen({super.key, required this.diaryId});

  @override
  ConsumerState<DiaryChatScreen> createState() => _DiaryChatScreenState();
}

class _DiaryChatScreenState extends ConsumerState<DiaryChatScreen> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  DiaryEntry? _entry;
  List<Message> _messages = [];
  bool _loading = false;
  bool _finalizing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final entry = await ref.read(diariesProvider.notifier).getWithMessages(widget.diaryId);
    if (entry == null || !mounted) return;
    setState(() {
      _entry = entry;
      _messages = entry.messages;
    });
    _scrollToBottom();
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
      conversationId: widget.diaryId,
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
          .read(diariesProvider.notifier)
          .sendMessage(widget.diaryId, text);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, reply];
        _loading = false;
      });
      _scrollToBottom();
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() {
        _messages = _messages.where((m) => m.id != userMsg.id).toList();
        _loading = false;
      });
      _inputCtrl.text = text;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('해피리 응답 실패: ${e.message ?? e.code}'),
          backgroundColor: HappilyColors.danger,
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
        SnackBar(content: Text('오류: $e'), backgroundColor: HappilyColors.danger),
      );
    }
  }

  Future<void> _finalize() async {
    if (_messages.where((m) => m.isUser).isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('아직 내용이 없어요')),
      );
      return;
    }
    setState(() => _finalizing = true);
    try {
      await ref.read(diariesProvider.notifier).finalize(widget.diaryId);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => DiaryViewScreen(diaryId: widget.diaryId)),
      );
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() => _finalizing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message ?? '정리 실패'), backgroundColor: HappilyColors.danger),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _finalizing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('오류: $e'), backgroundColor: HappilyColors.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final entry = _entry;
    final dateStr = entry != null
        ? DateFormat('M월 d일', 'ko_KR').format(entry.date)
        : '';

    return Scaffold(
      backgroundColor: entry?.type.color.withOpacity(0.25) ?? HappilyColors.background,
      appBar: AppBar(
        backgroundColor: entry?.type.color.withOpacity(0.25),
        title: Column(
          children: [
            Text(
              entry?.type.label ?? '일기',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            if (entry != null)
              Text(
                dateStr,
                style: const TextStyle(fontSize: 11, color: HappilyColors.muted, fontWeight: FontWeight.w400),
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _finalizing ? null : _finalize,
            child: _finalizing
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text(
                    '완성하기',
                    style: TextStyle(fontWeight: FontWeight.w600, color: HappilyColors.primary),
                  ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty && !_loading
                ? _buildIntro(entry)
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
          _buildInput(),
        ],
      ),
    );
  }

  Widget _buildIntro(DiaryEntry? entry) {
    if (entry == null) return const SizedBox.shrink();
    final greeting = switch (entry.type) {
      DiaryType.emotion => '오늘 어떤 감정이 있었나요?\n무엇이든 편하게 이야기해주세요.',
      DiaryType.happy => '오늘 칭찬할 일과 감사할 일을\n같이 찾아볼까요?',
      DiaryType.free => '지금 떠오르는 생각이 있다면\n자유롭게 적어주세요.',
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: entry.type.color, shape: BoxShape.circle),
              child: Icon(entry.type.icon, size: 32, color: HappilyColors.ink),
            ),
            const SizedBox(height: 20),
            Text(
              greeting,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, color: HappilyColors.ink, height: 1.7),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInput() {
    return Container(
      decoration: const BoxDecoration(
        color: HappilyColors.background,
        border: Border(top: BorderSide(color: Color(0xFFE3DFD8))),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          left: 12,
          right: 8,
          bottom: MediaQuery.of(context).viewInsets.bottom + 12,
          top: 10,
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputCtrl,
                minLines: 1,
                maxLines: 5,
                decoration: InputDecoration(
                  hintText: '편하게 이야기해주세요',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: const BorderSide(color: HappilyColors.primary, width: 1),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: _loading ? null : _send,
              icon: const Icon(Icons.arrow_upward, size: 20),
              style: IconButton.styleFrom(backgroundColor: HappilyColors.primary),
            ),
          ],
        ),
      ),
    );
  }
}
