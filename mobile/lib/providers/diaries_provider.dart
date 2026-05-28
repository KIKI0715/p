import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/diary_entry.dart';
import '../models/message.dart';

DateTime _normalizeDate(DateTime d) => DateTime(d.year, d.month, d.day);

class DiariesNotifier extends StateNotifier<AsyncValue<List<DiaryEntry>>> {
  DiariesNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  CollectionReference<Map<String, dynamic>>? get _ref {
    final uid = _uid;
    if (uid == null) return null;
    return FirebaseFirestore.instance.collection('users').doc(uid).collection('diaries');
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final ref = _ref;
      if (ref == null) {
        state = const AsyncValue.data([]);
        return;
      }
      final snap = await ref.orderBy('date', descending: true).get();
      state = AsyncValue.data(
        snap.docs.map((d) => DiaryEntry.fromSnapshot(d)).toList(),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<DiaryEntry?> create({
    required DateTime date,
    required DiaryType type,
    Mood? mood,
  }) async {
    final ref = _ref;
    if (ref == null) return null;
    final normalized = _normalizeDate(date);
    final now = FieldValue.serverTimestamp();
    final docRef = await ref.add({
      'date': Timestamp.fromDate(normalized),
      'type': type.id,
      'mood': mood?.value,
      'title': '',
      'summary': '',
      'createdAt': now,
      'updatedAt': now,
    });
    final snap = await docRef.get();
    final entry = DiaryEntry.fromSnapshot(snap);
    state.whenData((list) => state = AsyncValue.data([entry, ...list]));
    return entry;
  }

  Future<DiaryEntry?> getWithMessages(String id) async {
    final ref = _ref;
    if (ref == null) return null;
    final snap = await ref.doc(id).get();
    if (!snap.exists) return null;
    final msgSnap =
        await snap.reference.collection('messages').orderBy('createdAt').get();
    final messages = msgSnap.docs
        .map((d) => Message.fromSnapshot(d, conversationId: id))
        .toList();
    return DiaryEntry.fromSnapshot(snap, messages: messages);
  }

  Future<bool> delete(String id) async {
    final ref = _ref;
    if (ref == null) return false;
    await ref.doc(id).delete();
    state.whenData(
      (list) => state = AsyncValue.data(list.where((e) => e.id != id).toList()),
    );
    return true;
  }

  Future<Message> sendMessage(String diaryId, String content) async {
    final result = await FirebaseFunctions.instance
        .httpsCallable('sendDiaryMessage')
        .call({'diaryId': diaryId, 'content': content});
    final data = Map<String, dynamic>.from(result.data as Map);
    return Message.fromMap(data, conversationId: diaryId);
  }

  // Generate AI summary + title for the diary based on the chat so far.
  Future<DiaryEntry?> finalize(String diaryId) async {
    try {
      await FirebaseFunctions.instance
          .httpsCallable(
            'finalizeDiary',
            options: HttpsCallableOptions(timeout: const Duration(seconds: 120)),
          )
          .call({'diaryId': diaryId});
      final updated = await getWithMessages(diaryId);
      if (updated != null) {
        state.whenData((list) {
          final next = list.map((e) => e.id == diaryId ? updated : e).toList();
          state = AsyncValue.data(next);
        });
      }
      return updated;
    } on FirebaseFunctionsException {
      rethrow;
    }
  }

  Future<bool> updateMood(String diaryId, Mood mood) async {
    final ref = _ref;
    if (ref == null) return false;
    await ref.doc(diaryId).update({
      'mood': mood.value,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    state.whenData((list) {
      final next = list.map((e) {
        if (e.id != diaryId) return e;
        return DiaryEntry(
          id: e.id,
          date: e.date,
          type: e.type,
          mood: mood,
          title: e.title,
          summary: e.summary,
          createdAt: e.createdAt,
          updatedAt: DateTime.now(),
          messages: e.messages,
        );
      }).toList();
      state = AsyncValue.data(next);
    });
    return true;
  }
}

final diariesProvider =
    StateNotifierProvider<DiariesNotifier, AsyncValue<List<DiaryEntry>>>(
  (ref) => DiariesNotifier(),
);
