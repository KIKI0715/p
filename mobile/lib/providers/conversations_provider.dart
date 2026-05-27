import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class ConversationsNotifier extends StateNotifier<AsyncValue<List<Conversation>>> {
  ConversationsNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  CollectionReference<Map<String, dynamic>>? get _convRef {
    final uid = _uid;
    if (uid == null) return null;
    return FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .collection('conversations');
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final ref = _convRef;
      if (ref == null) {
        state = const AsyncValue.data([]);
        return;
      }
      final snap = await ref.orderBy('updatedAt', descending: true).get();
      state = AsyncValue.data(
        snap.docs.map((d) => Conversation.fromSnapshot(d)).toList(),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Conversation?> create(String title, List<String> tags) async {
    try {
      final ref = _convRef;
      if (ref == null) return null;
      final now = FieldValue.serverTimestamp();
      final docRef = await ref.add({'title': title.trim(), 'tags': tags, 'createdAt': now, 'updatedAt': now});
      final snap = await docRef.get();
      final conv = Conversation.fromSnapshot(snap);
      state.whenData((list) => state = AsyncValue.data([conv, ...list]));
      return conv;
    } catch (_) {
      return null;
    }
  }

  Future<Conversation?> getWithMessages(String id) async {
    try {
      final uid = _uid;
      if (uid == null) return null;
      final convSnap = await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('conversations')
          .doc(id)
          .get();
      if (!convSnap.exists) return null;

      final msgSnap = await convSnap.reference
          .collection('messages')
          .orderBy('createdAt')
          .get();
      final messages = msgSnap.docs
          .map((d) => Message.fromSnapshot(d, conversationId: id))
          .toList();
      return Conversation.fromSnapshot(convSnap, messages: messages);
    } catch (_) {
      return null;
    }
  }

  Future<bool> delete(String id) async {
    try {
      final uid = _uid;
      if (uid == null) return false;
      await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('conversations')
          .doc(id)
          .delete();
      state.whenData(
        (list) => state = AsyncValue.data(list.where((c) => c.id != id).toList()),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Message?> sendMessage(String conversationId, String content) async {
    try {
      final result = await FirebaseFunctions.instance
          .httpsCallable('sendMessage')
          .call({'conversationId': conversationId, 'content': content});
      final data = Map<String, dynamic>.from(result.data as Map);
      return Message.fromMap(data, conversationId: conversationId);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> generateArticle(String conversationId) async {
    try {
      final result = await FirebaseFunctions.instance
          .httpsCallable('generateArticle', options: HttpsCallableOptions(timeout: const Duration(seconds: 120)))
          .call({'conversationId': conversationId});
      return Map<String, dynamic>.from(result.data as Map);
    } on FirebaseFunctionsException catch (e) {
      return {'error': e.message ?? 'Generation failed'};
    } catch (e) {
      return {'error': e.toString()};
    }
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, AsyncValue<List<Conversation>>>(
  (ref) => ConversationsNotifier(),
);
