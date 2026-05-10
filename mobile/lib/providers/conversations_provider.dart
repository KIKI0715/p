import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../models/conversation.dart';
import '../models/message.dart';

class ConversationsNotifier extends StateNotifier<AsyncValue<List<Conversation>>> {
  ConversationsNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final response = await ApiClient.get('/conversations');
      final list = ApiClient.parseJsonList(response);
      state = AsyncValue.data(
        list.map((e) => Conversation.fromJson(e as Map<String, dynamic>)).toList(),
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Conversation?> create(String title, List<String> tags) async {
    try {
      final response = await ApiClient.post('/conversations', {'title': title, 'tags': tags});
      if (response.statusCode == 201) {
        final conv = Conversation.fromJson(ApiClient.parseJson(response));
        state.whenData((list) => state = AsyncValue.data([conv, ...list]));
        return conv;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Conversation?> getWithMessages(String id) async {
    try {
      final response = await ApiClient.get('/conversations/$id');
      if (response.statusCode == 200) {
        return Conversation.fromJson(ApiClient.parseJson(response));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> delete(String id) async {
    try {
      final response = await ApiClient.delete('/conversations/$id');
      if (response.statusCode == 200) {
        state.whenData(
          (list) => state = AsyncValue.data(list.where((c) => c.id != id).toList()),
        );
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<Message?> sendMessage(String conversationId, String content) async {
    try {
      final response = await ApiClient.post('/conversations/$conversationId/messages', {'content': content});
      if (response.statusCode == 201) {
        return Message.fromJson(ApiClient.parseJson(response));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> generateArticle(String conversationId) async {
    try {
      final response = await ApiClient.post('/conversations/$conversationId/generate-article', {});
      if (response.statusCode == 201) {
        return ApiClient.parseJson(response);
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return {'error': body['error'] ?? 'Generation failed'};
    } catch (e) {
      return {'error': e.toString()};
    }
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, AsyncValue<List<Conversation>>>(
  (ref) => ConversationsNotifier(),
);
