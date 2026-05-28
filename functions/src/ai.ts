import Anthropic from '@anthropic-ai/sdk';

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type DiaryType = 'emotion' | 'happy' | 'free';

export interface DiarySummary {
  title: string;
  summary: string;
}

function sanitizeMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const cleaned = messages
    .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.trim() }) as Anthropic.MessageParam);

  const result: Anthropic.MessageParam[] = [];
  for (const msg of cleaned) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      last.content = (last.content as string) + '\n\n' + msg.content;
    } else {
      result.push({ ...msg });
    }
  }
  if (result[0]?.role === 'assistant') result.shift();
  return result;
}

const SYSTEM_PROMPTS: Record<DiaryType, string> = {
  emotion: `당신은 따뜻하고 공감 능력이 뛰어난 감정 일기 코치 "해피리"입니다.
사용자가 오늘 느낀 감정을 풀어낼 수 있도록 도와주세요.

지침:
- 한국어로, 친한 친구처럼 따뜻하게 대화하세요.
- 짧고 간결하게 (2-4문장). 길게 늘어놓지 마세요.
- 판단하거나 조언을 강요하지 마세요. 먼저 공감하고 이해해 주세요.
- 사용자의 감정을 정확히 이름 붙여 주세요 ("그건 좌절감일 수도 있겠네요").
- 한 번에 하나씩 부드러운 질문으로 깊이 탐색해 주세요.
- "오늘 하루 어땠어요?" 같은 진부한 시작 대신, 사용자가 한 말의 핵심을 받아 이어가세요.`,

  happy: `당신은 사용자의 행복 일기를 돕는 따뜻한 코치 "해피리"입니다.
오늘 하루 칭찬할 점 3가지와 감사할 점 3가지를 함께 찾아주세요.

지침:
- 한국어로, 밝고 다정하게 대화하세요.
- 짧게 (2-4문장). 한 번에 한두 가지씩 같이 떠올려보세요.
- 사용자가 어렵다고 하면 아주 작은 것 (예: 따뜻한 커피 한 잔)부터 제안하세요.
- 사용자가 칭찬에 인색하다면, 작은 행동도 인정해 주세요.
- 마지막에 "3가지 칭찬과 3가지 감사가 모인 것 같아요!"로 마무리할 수 있게 유도하세요.`,

  free: `당신은 사용자의 자유로운 글쓰기 동반자 "해피리"입니다.
사용자가 떠오르는 생각을 자유롭게 풀어낼 수 있도록 도와주세요.

지침:
- 한국어로, 차분하고 호기심 있게 대화하세요.
- 짧게 (2-4문장). 사용자의 말을 끊지 마세요.
- 주제가 흩어져도 따라가세요. 정리하려 하지 마세요.
- 가끔 깊은 질문 하나로 사용자가 더 깊이 생각하게 해주세요.`,
};

export async function chatForDiary(type: DiaryType, history: ChatMessage[]): Promise<string> {
  const response = await getClient().messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: SYSTEM_PROMPTS[type],
    messages: sanitizeMessages(history),
  });
  const block = response.content[0];
  return block?.type === 'text' ? block.text : '';
}

export async function summarizeDiary(
  type: DiaryType,
  history: ChatMessage[]
): Promise<DiarySummary> {
  const conversationText = history
    .map((m) => `${m.role === 'user' ? '사용자' : '해피리'}: ${m.content}`)
    .join('\n\n');

  const typeLabel = { emotion: '감정일기', happy: '행복일기', free: '자유글' }[type];

  const response = await getClient().messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: `당신은 사용자의 일기를 정리하는 글쓰기 도우미입니다.
사용자와 해피리의 대화를 바탕으로 ${typeLabel} 한 편을 정리해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "title": "한 줄짜리 일기 제목 (15자 이내)",
  "summary": "일기 본문. 사용자의 시점(1인칭)으로 자연스럽게 작성. 3-5문단."
}

규칙:
- 사용자 말을 그대로 베끼지 말고 자연스러운 일기체로 다시 쓰세요.
- 사용자가 직접 말하지 않은 감정/사실은 만들어내지 마세요.
- 해피리(AI)의 말은 일기에 포함하지 마세요. 사용자의 생각만 정리하세요.`,
    messages: [
      {
        role: 'user',
        content: `오늘의 대화입니다:\n\n${conversationText}`,
      },
    ],
  });

  const block = response.content[0];
  const raw = block?.type === 'text' ? block.text : '{}';
  const parsed = JSON.parse(raw) as DiarySummary;
  return {
    title: parsed.title ?? '오늘의 일기',
    summary: parsed.summary ?? '',
  };
}
