import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(history: ChatMessage[]): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert developer assistant. Help the user think through technical ideas, architectures, and code. Be concise and precise.',
      },
      ...history,
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

export interface GeneratedArticle {
  title: string;
  content: string;
  tags: string[];
}

export async function generateArticle(history: ChatMessage[]): Promise<GeneratedArticle> {
  const conversationText = history
    .map((m) => `${m.role === 'user' ? 'Developer' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a technical writer who transforms developer conversations into polished blog articles for Dev.to.

Given a conversation, extract the core technical insight and write a structured article.
Respond with ONLY a valid JSON object (no markdown fences) in this exact shape:
{
  "title": "A compelling, specific article title",
  "content": "Full article body in GitHub-flavored Markdown. Include an intro, headings, code blocks where appropriate, and a conclusion.",
  "tags": ["tag1", "tag2", "tag3"]
}

Tags must be valid Dev.to tags (lowercase, no spaces, max 4 tags).`,
      },
      {
        role: 'user',
        content: `Here is the conversation to transform into an article:\n\n${conversationText}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as GeneratedArticle;
  return {
    title: parsed.title ?? 'Untitled',
    content: parsed.content ?? '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
  };
}
