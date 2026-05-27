import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/article.dart';

class ArticlesNotifier extends StateNotifier<AsyncValue<List<Article>>> {
  ArticlesNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  String? get _uid => FirebaseAuth.instance.currentUser?.uid;

  CollectionReference<Map<String, dynamic>>? get _articlesRef {
    final uid = _uid;
    if (uid == null) return null;
    return FirebaseFirestore.instance
        .collection('users')
        .doc(uid)
        .collection('articles');
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final ref = _articlesRef;
      if (ref == null) {
        state = const AsyncValue.data([]);
        return;
      }
      final snap = await ref.orderBy('updatedAt', descending: true).get();
      state = AsyncValue.data(
        snap.docs.map((d) => Article.fromSnapshot(d)).toList(),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Article?> update(String id, {String? title, String? content, List<String>? tags}) async {
    try {
      final ref = _articlesRef;
      if (ref == null) return null;
      final updates = <String, dynamic>{
        'updatedAt': FieldValue.serverTimestamp(),
        if (title != null) 'title': title,
        if (content != null) 'content': content,
        if (tags != null) 'tags': tags,
      };
      await ref.doc(id).update(updates);
      final snap = await ref.doc(id).get();
      final updated = Article.fromSnapshot(snap);
      state.whenData((list) => state = AsyncValue.data(
            list.map((a) => a.id == id ? updated : a).toList(),
          ));
      return updated;
    } catch (_) {
      return null;
    }
  }

  Future<bool> delete(String id) async {
    try {
      final ref = _articlesRef;
      if (ref == null) return false;
      await ref.doc(id).delete();
      state.whenData(
        (list) => state = AsyncValue.data(list.where((a) => a.id != id).toList()),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Article?> publish(String id) async {
    try {
      final result = await FirebaseFunctions.instance
          .httpsCallable('publishToDev')
          .call({'articleId': id});
      final data = Map<String, dynamic>.from(result.data as Map);
      final updated = Article.fromMap(data);
      state.whenData((list) => state = AsyncValue.data(
            list.map((a) => a.id == id ? updated : a).toList(),
          ));
      return updated;
    } on FirebaseFunctionsException catch (e) {
      throw Exception(e.message ?? 'Publish failed');
    }
  }

  void addArticle(Article article) {
    state.whenData((list) => state = AsyncValue.data([article, ...list]));
  }
}

final articlesProvider =
    StateNotifierProvider<ArticlesNotifier, AsyncValue<List<Article>>>(
  (ref) => ArticlesNotifier(),
);
