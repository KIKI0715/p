import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../models/article.dart';

class ArticlesNotifier extends StateNotifier<AsyncValue<List<Article>>> {
  ArticlesNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final response = await ApiClient.get('/articles');
      final list = ApiClient.parseJsonList(response);
      state = AsyncValue.data(
        list.map((e) => Article.fromJson(e as Map<String, dynamic>)).toList(),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Article?> update(String id, {String? title, String? content, List<String>? tags}) async {
    try {
      final response = await ApiClient.put('/articles/$id', {
        if (title != null) 'title': title,
        if (content != null) 'content': content,
        if (tags != null) 'tags': tags,
      });
      if (response.statusCode == 200) {
        final updated = Article.fromJson(ApiClient.parseJson(response));
        state.whenData((list) => state = AsyncValue.data(
              list.map((a) => a.id == id ? updated : a).toList(),
            ));
        return updated;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> delete(String id) async {
    try {
      final response = await ApiClient.delete('/articles/$id');
      if (response.statusCode == 200) {
        state.whenData(
          (list) => state = AsyncValue.data(list.where((a) => a.id != id).toList()),
        );
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<Article?> publish(String id) async {
    try {
      final response = await ApiClient.post('/articles/$id/publish', {});
      if (response.statusCode == 200) {
        final updated = Article.fromJson(ApiClient.parseJson(response));
        state.whenData((list) => state = AsyncValue.data(
              list.map((a) => a.id == id ? updated : a).toList(),
            ));
        return updated;
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Publish failed');
    } catch (e) {
      rethrow;
    }
  }
}

final articlesProvider =
    StateNotifierProvider<ArticlesNotifier, AsyncValue<List<Article>>>(
  (ref) => ArticlesNotifier(),
);
