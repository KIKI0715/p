import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { chatForDiary, summarizeDiary, ChatMessage, DiaryType } from './ai';

admin.initializeApp();
const db = admin.firestore();

function diaryRef(uid: string, diaryId: string) {
  return db.collection('users').doc(uid).collection('diaries').doc(diaryId);
}

// ─── sendDiaryMessage ────────────────────────────────────────────────────────
// User sends a message inside a diary; Claude replies in the diary's mode.
export const sendDiaryMessage = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const { diaryId, content } = request.data as { diaryId: string; content: string };
  if (!diaryId || !content?.trim()) {
    throw new HttpsError('invalid-argument', 'diaryId and content are required');
  }
  if (content.length > 4000) {
    throw new HttpsError('invalid-argument', 'Message must be 4000 characters or fewer');
  }

  const uid = request.auth.uid;
  const ref = diaryRef(uid, diaryId);
  const diarySnap = await ref.get();
  if (!diarySnap.exists) throw new HttpsError('not-found', 'Diary not found');
  const diaryType = (diarySnap.data()?.type as DiaryType) ?? 'emotion';

  const messagesRef = ref.collection('messages');
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
    assistantContent = await chatForDiary(diaryType, history);
  } catch (err) {
    console.error('chat failed', err);
    throw new HttpsError('unavailable', 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  const msgRef = await messagesRef.add({
    role: 'assistant',
    content: assistantContent,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await ref.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  return { id: msgRef.id, role: 'assistant', content: assistantContent };
});

// ─── finalizeDiary ───────────────────────────────────────────────────────────
// Generates a title + summary for the diary based on the chat history.
export const finalizeDiary = onCall(
  { maxInstances: 5, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

    const { diaryId } = request.data as { diaryId: string };
    if (!diaryId) throw new HttpsError('invalid-argument', 'diaryId is required');

    const uid = request.auth.uid;
    const ref = diaryRef(uid, diaryId);
    const diarySnap = await ref.get();
    if (!diarySnap.exists) throw new HttpsError('not-found', 'Diary not found');
    const diaryType = (diarySnap.data()?.type as DiaryType) ?? 'emotion';

    const messagesSnap = await ref.collection('messages').orderBy('createdAt').get();
    if (messagesSnap.empty) {
      throw new HttpsError('failed-precondition', '대화 내용이 없어요.');
    }

    const history: ChatMessage[] = messagesSnap.docs.map((doc) => ({
      role: doc.data().role as 'user' | 'assistant',
      content: doc.data().content as string,
    }));

    let generated;
    try {
      generated = await summarizeDiary(diaryType, history);
    } catch (err) {
      console.error('summarize failed', err);
      throw new HttpsError('unavailable', '일기를 정리하지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    await ref.update({
      title: generated.title,
      summary: generated.summary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { id: diaryId, title: generated.title, summary: generated.summary };
  }
);
