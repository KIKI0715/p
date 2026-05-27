import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { chat, generateArticle as generateArticleAI, ChatMessage } from './ai';
import { publishArticle } from './devto';
import { encrypt, decrypt } from './crypto';

admin.initializeApp();
const db = admin.firestore();

// ─── sendMessage ─────────────────────────────────────────────────────────────
// Flutter calls this to add a user message and receive an AI reply.
export const sendMessage = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const { conversationId, content } = request.data as {
    conversationId: string;
    content: string;
  };
  if (!conversationId || !content?.trim()) {
    throw new HttpsError('invalid-argument', 'conversationId and content are required');
  }
  if (content.length > 4000) {
    throw new HttpsError('invalid-argument', 'Message must be 4000 characters or fewer');
  }

  const uid = request.auth.uid;
  const convRef = db.collection('users').doc(uid).collection('conversations').doc(conversationId);
  if (!(await convRef.get()).exists) {
    throw new HttpsError('not-found', 'Conversation not found');
  }

  const messagesRef = convRef.collection('messages');

  await messagesRef.add({
    role: 'user',
    content: content.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const historySnap = await messagesRef.orderBy('createdAt').get();
  const history: ChatMessage[] = historySnap.docs.map((doc) => ({
    role: doc.data().role as 'user' | 'assistant',
    content: doc.data().content as string,
  }));

  let assistantContent: string;
  try {
    assistantContent = await chat(history);
  } catch {
    throw new HttpsError('unavailable', 'AI service unavailable, please try again shortly.');
  }

  const msgRef = await messagesRef.add({
    role: 'assistant',
    content: assistantContent,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await convRef.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  return { id: msgRef.id, role: 'assistant', content: assistantContent };
});

// ─── generateArticle ─────────────────────────────────────────────────────────
// Reads all messages in a conversation, calls Claude, saves the article draft.
export const generateArticle = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

    const { conversationId } = request.data as { conversationId: string };
    if (!conversationId) throw new HttpsError('invalid-argument', 'conversationId is required');

    const uid = request.auth.uid;
    const convRef = db
      .collection('users')
      .doc(uid)
      .collection('conversations')
      .doc(conversationId);
    if (!(await convRef.get()).exists) {
      throw new HttpsError('not-found', 'Conversation not found');
    }

    const messagesSnap = await convRef.collection('messages').orderBy('createdAt').get();
    if (messagesSnap.empty) {
      throw new HttpsError('failed-precondition', 'Conversation has no messages');
    }

    const history: ChatMessage[] = messagesSnap.docs.map((doc) => ({
      role: doc.data().role as 'user' | 'assistant',
      content: doc.data().content as string,
    }));

    let generated;
    try {
      generated = await generateArticleAI(history);
    } catch {
      throw new HttpsError('unavailable', 'AI service unavailable, please try again shortly.');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const articleRef = await db.collection('users').doc(uid).collection('articles').add({
      conversationId,
      title: generated.title,
      content: generated.content,
      tags: generated.tags,
      status: 'draft',
      devtoId: null,
      devtoUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: articleRef.id,
      conversationId,
      title: generated.title,
      content: generated.content,
      tags: generated.tags,
      status: 'draft',
      devtoId: null,
      devtoUrl: null,
    };
  }
);

// ─── publishToDev ─────────────────────────────────────────────────────────────
// Publishes an article to dev.to using the user's stored API key.
export const publishToDev = onCall({ maxInstances: 5 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const { articleId } = request.data as { articleId: string };
  if (!articleId) throw new HttpsError('invalid-argument', 'articleId is required');

  const uid = request.auth.uid;
  const articleRef = db.collection('users').doc(uid).collection('articles').doc(articleId);
  const articleSnap = await articleRef.get();
  if (!articleSnap.exists) throw new HttpsError('not-found', 'Article not found');

  const article = articleSnap.data()!;
  if (article.status === 'published') {
    throw new HttpsError('already-exists', 'Article already published');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const encryptedKey = userSnap.data()?.devtoApiKey as string | undefined;
  if (!encryptedKey) {
    throw new HttpsError(
      'failed-precondition',
      'No Dev.to API key configured. Update your profile first.'
    );
  }

  const apiKey = decrypt(encryptedKey);

  let result;
  try {
    result = await publishArticle(apiKey, article.title, article.content, article.tags);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      throw new HttpsError('permission-denied', 'Dev.to rejected the request: invalid API key.');
    } else if (status === 422) {
      throw new HttpsError(
        'invalid-argument',
        'Dev.to rejected the article content. Check the title and tags.'
      );
    } else {
      throw new HttpsError('unavailable', 'Dev.to is unavailable, please try again later.');
    }
  }

  await articleRef.update({
    status: 'published',
    devtoId: result.id,
    devtoUrl: result.url,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    id: articleId,
    ...article,
    status: 'published',
    devtoId: result.id,
    devtoUrl: result.url,
  };
});

// ─── setDevtoApiKey ───────────────────────────────────────────────────────────
// Encrypts and stores the user's Dev.to API key in their Firestore document.
export const setDevtoApiKey = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const { devtoApiKey } = request.data as { devtoApiKey: string };
  if (typeof devtoApiKey !== 'string' || devtoApiKey.trim() === '') {
    throw new HttpsError('invalid-argument', 'devtoApiKey must be a non-empty string');
  }

  const uid = request.auth.uid;
  await db
    .collection('users')
    .doc(uid)
    .set({ devtoApiKey: encrypt(devtoApiKey.trim()) }, { merge: true });

  return { hasDevtoKey: true };
});
