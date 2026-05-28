import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';
import '../providers/diaries_provider.dart';
import '../widgets/diary_mode_card.dart';
import '../widgets/mood_slider.dart';
import 'diary_chat_screen.dart';
import 'diary_view_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Mood? _todayMood;
  final _cardCtrl = PageController(viewportFraction: 0.62, initialPage: 0);
  int _cardIndex = 0;

  @override
  void dispose() {
    _cardCtrl.dispose();
    super.dispose();
  }

  Future<void> _startDiary(DiaryType type) async {
    final entry = await ref.read(diariesProvider.notifier).create(
          date: DateTime.now(),
          type: type,
          mood: _todayMood,
        );
    if (entry == null || !mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('일기를 시작할 수 없어요')),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => DiaryChatScreen(diaryId: entry.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final diaries = ref.watch(diariesProvider);
    final today = DateTime.now();
    final dateStr = DateFormat('yyyy년 M월 d일 EEEE', 'ko_KR').format(today);

    return Scaffold(
      appBar: AppBar(
        title: const Text('해피리'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                child: Text(
                  dateStr,
                  style: const TextStyle(fontSize: 15, color: HappilyColors.muted),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: MoodSlider(
                  value: _todayMood,
                  onChanged: (m) => setState(() => _todayMood = m),
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                height: 410,
                child: PageView.builder(
                  controller: _cardCtrl,
                  itemCount: DiaryType.values.length,
                  onPageChanged: (i) => setState(() => _cardIndex = i),
                  itemBuilder: (_, i) {
                    final type = DiaryType.values[i];
                    return Center(
                      child: DiaryModeCard(type: type, onTap: () => _startDiary(type)),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  DiaryType.values.length,
                  (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: i == _cardIndex ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _cardIndex
                          ? DiaryType.values[i].color
                          : const Color(0xFFD9D9D9),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              _PastDiariesSection(diaries: diaries),
            ],
          ),
        ),
      ),
    );
  }
}

class _PastDiariesSection extends StatelessWidget {
  final AsyncValue<List<DiaryEntry>> diaries;
  const _PastDiariesSection({required this.diaries});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '지난 일기',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: HappilyColors.ink),
          ),
          const SizedBox(height: 12),
          diaries.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Text('불러오기 실패: $e', style: const TextStyle(color: HappilyColors.danger)),
            data: (list) {
              if (list.isEmpty) {
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  alignment: Alignment.center,
                  child: const Text(
                    '아직 작성한 일기가 없어요',
                    style: TextStyle(color: HappilyColors.muted, fontSize: 14),
                  ),
                );
              }
              return Column(
                children: list.map((d) => _DiaryListTile(entry: d)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DiaryListTile extends StatelessWidget {
  final DiaryEntry entry;
  const _DiaryListTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat('M월 d일', 'ko_KR').format(entry.date);
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DiaryViewScreen(diaryId: entry.id)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: HappilyColors.card,
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [
            BoxShadow(color: Color(0x0D000000), blurRadius: 6, offset: Offset(0, 1)),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 6,
              height: 48,
              decoration: BoxDecoration(
                color: entry.type.color,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        dateStr,
                        style: const TextStyle(
                          fontSize: 13,
                          color: HappilyColors.muted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: entry.type.color,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          entry.type.label,
                          style: const TextStyle(fontSize: 11, color: HappilyColors.ink),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    entry.title.isEmpty ? '(작성 중)' : entry.title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: HappilyColors.ink,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (entry.mood != null)
              Container(
                width: 28,
                height: 24,
                decoration: BoxDecoration(
                  color: entry.mood!.color,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
