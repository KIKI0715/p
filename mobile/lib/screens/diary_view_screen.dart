import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';
import '../providers/diaries_provider.dart';
import 'diary_chat_screen.dart';

class DiaryViewScreen extends ConsumerStatefulWidget {
  final String diaryId;
  const DiaryViewScreen({super.key, required this.diaryId});

  @override
  ConsumerState<DiaryViewScreen> createState() => _DiaryViewScreenState();
}

class _DiaryViewScreenState extends ConsumerState<DiaryViewScreen> {
  DiaryEntry? _entry;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final entry = await ref.read(diariesProvider.notifier).getWithMessages(widget.diaryId);
    if (!mounted) return;
    setState(() {
      _entry = entry;
      _loading = false;
    });
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('일기를 삭제할까요?'),
        content: const Text('이 일기와 대화 내용이 모두 삭제돼요.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제', style: TextStyle(color: HappilyColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(diariesProvider.notifier).delete(widget.diaryId);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final entry = _entry;
    if (entry == null) {
      return const Scaffold(body: Center(child: Text('일기를 찾을 수 없어요')));
    }

    final dateStr = DateFormat('yyyy년 M월 d일 EEEE', 'ko_KR').format(entry.date);
    final hasContent = entry.summary.isNotEmpty;

    return Scaffold(
      backgroundColor: entry.type.color.withOpacity(0.25),
      appBar: AppBar(
        backgroundColor: entry.type.color.withOpacity(0.25),
        title: Text(entry.type.label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline, size: 20),
            tooltip: '대화 이어가기',
            onPressed: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => DiaryChatScreen(diaryId: widget.diaryId)),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            onPressed: _confirmDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  dateStr,
                  style: const TextStyle(fontSize: 13, color: HappilyColors.muted),
                ),
                const Spacer(),
                if (entry.mood != null) _MoodBadge(mood: entry.mood!),
              ],
            ),
            const SizedBox(height: 20),
            if (!hasContent)
              _buildEmpty(entry)
            else
              _buildPaper(entry),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(DiaryEntry entry) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Icon(entry.type.icon, size: 36, color: HappilyColors.muted),
          const SizedBox(height: 12),
          const Text(
            '아직 정리되지 않은 일기예요',
            style: TextStyle(fontSize: 15, color: HappilyColors.ink, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            '대화를 이어가고 "완성하기"를 눌러보세요.',
            style: TextStyle(fontSize: 13, color: HappilyColors.muted),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => DiaryChatScreen(diaryId: widget.diaryId)),
            ),
            child: const Text('대화 이어가기'),
          ),
        ],
      ),
    );
  }

  Widget _buildPaper(DiaryEntry entry) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(color: Color(0x1A000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            entry.title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              color: HappilyColors.ink,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            entry.summary,
            style: const TextStyle(fontSize: 15, color: HappilyColors.ink, height: 1.9),
          ),
        ],
      ),
    );
  }
}

class _MoodBadge extends StatelessWidget {
  final Mood mood;
  const _MoodBadge({required this.mood});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: mood.color.withOpacity(0.25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: mood.color, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: mood.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            mood.label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: HappilyColors.ink),
          ),
        ],
      ),
    );
  }
}
