import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/theme.dart';
import 'package:flutter/material.dart';
import 'message.dart';

enum DiaryType {
  emotion, // 감정일기
  happy,   // 행복일기 (오늘의 칭찬 3 + 감사 3)
  free,    // 자유글
}

extension DiaryTypeX on DiaryType {
  String get id => switch (this) {
        DiaryType.emotion => 'emotion',
        DiaryType.happy => 'happy',
        DiaryType.free => 'free',
      };

  String get label => switch (this) {
        DiaryType.emotion => '감정일기',
        DiaryType.happy => '행복일기',
        DiaryType.free => '자유글',
      };

  String get description => switch (this) {
        DiaryType.emotion => '오늘 느낀 감정을\nClaude와 함께 풀어보세요.',
        DiaryType.happy => '오늘을 돌아보며\n칭찬할 점 3가지,\n감사할 점 3가지를\n작성해보세요.',
        DiaryType.free => '형식 없이 떠오르는 생각을\n자유롭게 적어보세요.',
      };

  Color get color => switch (this) {
        DiaryType.emotion => HappilyColors.moodEmotion,
        DiaryType.happy => HappilyColors.moodHappy,
        DiaryType.free => HappilyColors.moodFree,
      };

  IconData get icon => switch (this) {
        DiaryType.emotion => Icons.favorite_border,
        DiaryType.happy => Icons.wb_sunny_outlined,
        DiaryType.free => Icons.edit_note,
      };

  static DiaryType fromId(String? id) => switch (id) {
        'happy' => DiaryType.happy,
        'free' => DiaryType.free,
        _ => DiaryType.emotion,
      };
}

// 5-step mood scale matching the Figma jelly slider
enum Mood { worst, bad, soso, good, great }

extension MoodX on Mood {
  int get value => index + 1;

  String get label => switch (this) {
        Mood.worst => '꽝',
        Mood.bad => '별로',
        Mood.soso => '보통',
        Mood.good => '좋음',
        Mood.great => '아주 좋음',
      };

  Color get color => HappilyColors.moodPalette[index];

  static Mood fromValue(int? v) {
    if (v == null) return Mood.soso;
    return Mood.values[(v - 1).clamp(0, 4)];
  }
}

class DiaryEntry {
  final String id;
  final DateTime date; // The day this diary belongs to (local date, midnight)
  final DiaryType type;
  final Mood? mood;
  final String title;
  final String summary; // AI-written summary, shown on cards
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Message> messages;

  const DiaryEntry({
    required this.id,
    required this.date,
    required this.type,
    required this.mood,
    required this.title,
    required this.summary,
    required this.createdAt,
    required this.updatedAt,
    this.messages = const [],
  });

  factory DiaryEntry.fromSnapshot(
    DocumentSnapshot doc, {
    List<Message> messages = const [],
  }) {
    final data = doc.data() as Map<String, dynamic>;
    return DiaryEntry(
      id: doc.id,
      date: (data['date'] as Timestamp?)?.toDate() ?? DateTime.now(),
      type: DiaryTypeX.fromId(data['type'] as String?),
      mood: data['mood'] != null ? MoodX.fromValue(data['mood'] as int?) : null,
      title: data['title'] as String? ?? '',
      summary: data['summary'] as String? ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      messages: messages,
    );
  }
}
