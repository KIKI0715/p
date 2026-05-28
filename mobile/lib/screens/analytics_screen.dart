import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';
import '../providers/diaries_provider.dart';

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  // Monday of the selected week
  late DateTime _weekStart;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _weekStart = _monday(now);
  }

  static DateTime _monday(DateTime d) {
    final day = DateTime(d.year, d.month, d.day);
    return day.subtract(Duration(days: day.weekday - 1));
  }

  List<DateTime> get _weekDays =>
      List.generate(7, (i) => _weekStart.add(Duration(days: i)));

  bool get _isCurrentWeek =>
      _monday(DateTime.now()) == _weekStart;

  String get _weekLabel {
    final month = _weekStart.month;
    final weekInMonth = ((_weekStart.day - 1) ~/ 7) + 1;
    return '${_weekStart.year}년 ${month}월 ${weekInMonth}주차';
  }

  // Build mood value map: date → mood level (1-5) for the week
  Map<DateTime, double> _moodMap(List<DiaryEntry> entries) {
    final map = <DateTime, double>{};
    for (final day in _weekDays) {
      final dayEntries = entries
          .where((e) =>
              e.mood != null &&
              e.date.year == day.year &&
              e.date.month == day.month &&
              e.date.day == day.day)
          .toList();
      if (dayEntries.isNotEmpty) {
        // Use the most recently created entry's mood for that day
        dayEntries.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        map[day] = dayEntries.first.mood!.value.toDouble();
      }
    }
    return map;
  }

  // Mood distribution for the week
  Map<String, int> _distribution(List<DiaryEntry> entries) {
    final weekEntries = entries.where((e) {
      if (e.mood == null) return false;
      final d = e.date;
      return !d.isBefore(_weekStart) &&
          d.isBefore(_weekStart.add(const Duration(days: 7)));
    }).toList();

    int pos = 0, neu = 0, neg = 0;
    for (final e in weekEntries) {
      final v = e.mood!.value;
      if (v >= 4) pos++;
      else if (v == 3) neu++;
      else neg++;
    }
    return {'긍정': pos, '중립': neu, '부정': neg};
  }

  String _aiComment(Map<String, int> dist) {
    final total = dist.values.fold(0, (a, b) => a + b);
    if (total == 0) return '이번 주 일기를 작성하면 감정 분석을 볼 수 있어요 📝';
    final pos = (dist['긍정']! / total * 100).round();
    final neg = (dist['부정']! / total * 100).round();
    if (neg > 60) return '이번 주는 많이 힘드셨군요. 자신을 위한 시간을 가져보세요 💙';
    if (neg > 40) return '이번 주는 힘든 일이 있었던 것 같아요. 다음 주는 더 좋은 일이 가득하길 바라요 :)';
    if (pos > 60) return '이번 주는 꽤 좋은 한 주였네요! 앞으로도 행복한 날들이 이어지길 바라요 ✨';
    return '이번 주는 그럭저럭 괜찮은 한 주였네요. 작은 행복들을 발견하셨나요? 😊';
  }

  @override
  Widget build(BuildContext context) {
    final allEntries = ref.watch(diariesProvider).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('분석'),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _WeekPicker(
              label: _weekLabel,
              onPrev: () => setState(() => _weekStart = _weekStart.subtract(const Duration(days: 7))),
              onNext: _isCurrentWeek ? null : () => setState(() => _weekStart = _weekStart.add(const Duration(days: 7))),
            ),
            const SizedBox(height: 20),
            const Text('감정 변화', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: HappilyColors.ink)),
            const SizedBox(height: 12),
            _MoodLineChart(weekDays: _weekDays, moodMap: _moodMap(allEntries)),
            const SizedBox(height: 28),
            const Text('감정 분석', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: HappilyColors.ink)),
            const SizedBox(height: 12),
            _EmotionAnalysisCard(
              distribution: _distribution(allEntries),
              comment: _aiComment(_distribution(allEntries)),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Week picker ─────────────────────────────────────────────────────────────

class _WeekPicker extends StatelessWidget {
  final String label;
  final VoidCallback onPrev;
  final VoidCallback? onNext;

  const _WeekPicker({required this.label, required this.onPrev, this.onNext});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          onPressed: onPrev,
          icon: const Icon(Icons.chevron_left),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: HappilyColors.ink),
        ),
        IconButton(
          onPressed: onNext,
          icon: Icon(Icons.chevron_right, color: onNext != null ? HappilyColors.ink : HappilyColors.muted),
        ),
      ],
    );
  }
}

// ─── Line chart ──────────────────────────────────────────────────────────────

class _MoodLineChart extends StatelessWidget {
  final List<DateTime> weekDays;
  final Map<DateTime, double> moodMap;

  const _MoodLineChart({required this.weekDays, required this.moodMap});

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (var i = 0; i < weekDays.length; i++) {
      final v = moodMap[weekDays[i]];
      if (v != null) spots.add(FlSpot(i.toDouble(), v));
    }

    final dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

    return Container(
      height: 220,
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(1, 1))],
      ),
      child: spots.isEmpty
          ? Center(
              child: Text(
                '이번 주 기분을 기록해 보세요',
                style: TextStyle(color: HappilyColors.muted, fontSize: 13),
              ),
            )
          : LineChart(
              LineChartData(
                minY: 0.5,
                maxY: 5.5,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: true,
                  horizontalInterval: 1,
                  getDrawingHorizontalLine: (_) =>
                      const FlLine(color: Color(0xFFF0EDE7), strokeWidth: 1),
                  getDrawingVerticalLine: (_) =>
                      const FlLine(color: Color(0xFFF0EDE7), strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: 1,
                      getTitlesWidget: (v, _) {
                        final m = MoodX.fromValue(v.round());
                        return Container(
                          width: 10,
                          height: 8,
                          margin: const EdgeInsets.only(right: 2),
                          decoration: BoxDecoration(
                            color: m.color,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 24,
                      getTitlesWidget: (v, _) {
                        final idx = v.round();
                        if (idx < 0 || idx >= dayLabels.length) return const SizedBox.shrink();
                        return Text(
                          dayLabels[idx],
                          style: const TextStyle(fontSize: 12, color: HappilyColors.muted),
                        );
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: HappilyColors.primary,
                    barWidth: 2.5,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, _, __, ___) {
                        final mood = MoodX.fromValue(spot.y.round());
                        return FlDotCirclePainter(
                          radius: 5,
                          color: mood.color,
                          strokeColor: Colors.white,
                          strokeWidth: 1.5,
                        );
                      },
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      color: HappilyColors.primary.withOpacity(0.08),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

// ─── Emotion analysis card ────────────────────────────────────────────────────

class _EmotionAnalysisCard extends StatelessWidget {
  final Map<String, int> distribution;
  final String comment;

  const _EmotionAnalysisCard({required this.distribution, required this.comment});

  @override
  Widget build(BuildContext context) {
    final total = distribution.values.fold(0, (a, b) => a + b);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(1, 1))],
      ),
      child: Column(
        children: [
          // Speech bubble comment
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: HappilyColors.background,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE3DFD8)),
            ),
            child: Text(
              comment,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: HappilyColors.ink, height: 1.5),
            ),
          ),
          const SizedBox(height: 20),
          total == 0
              ? const SizedBox(height: 140, child: Center(child: Text('아직 기록이 없어요', style: TextStyle(color: HappilyColors.muted, fontSize: 13))))
              : Row(
                  children: [
                    SizedBox(
                      width: 140,
                      height: 140,
                      child: PieChart(
                        PieChartData(
                          sectionsSpace: 2,
                          centerSpaceRadius: 40,
                          sections: [
                            _section('긍정', distribution['긍정']!, total, const Color(0xFF81C784)),
                            _section('중립', distribution['중립']!, total, const Color(0xFFBDBDBD)),
                            _section('부정', distribution['부정']!, total, const Color(0xFFE57373)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _legendRow('긍정', distribution['긍정']!, total, const Color(0xFF81C784)),
                          const SizedBox(height: 10),
                          _legendRow('중립', distribution['중립']!, total, const Color(0xFFBDBDBD)),
                          const SizedBox(height: 10),
                          _legendRow('부정', distribution['부정']!, total, const Color(0xFFE57373)),
                        ],
                      ),
                    ),
                  ],
                ),
        ],
      ),
    );
  }

  PieChartSectionData _section(String label, int count, int total, Color color) {
    final pct = total == 0 ? 0.0 : count / total * 100;
    return PieChartSectionData(
      color: color,
      value: count == 0 ? 0.001 : count.toDouble(),
      title: pct >= 10 ? '${pct.round()}%' : '',
      radius: 40,
      titleStyle: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600),
    );
  }

  Widget _legendRow(String label, int count, int total, Color color) {
    final pct = total == 0 ? 0 : (count / total * 100).round();
    return Row(
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 13, color: HappilyColors.ink)),
        const Spacer(),
        Text('$pct%', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: HappilyColors.ink)),
      ],
    );
  }
}
