import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizeMessages(history: ChatMessage[]): ChatMessage[] {
  const filtered = history.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (filtered.length === 0) return [];

  const result: ChatMessage[] = [];
  for (const msg of filtered) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  if (result[0]?.role === 'assistant') {
    result.shift();
  }

  return result;
}

export interface GeneratedArticle {
  title: string;
  content: string;
  tags: string[];
}

export async function chat(history: ChatMessage[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system:
      'You are an expert developer assistant. Help the user think through technical ideas, architectures, and code. Be concise and precise.',
    messages: sanitizeMessages(history),
  });
  const block = response.content[0];
  return block?.type === 'text' ? block.text : '';
}

export async function generateArticle(history: ChatMessage[]): Promise<GeneratedArticle> {
  const conversationText = history
    .map((m) => `${m.role === 'user' ? 'Developer' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: `You are a technical writer who transforms developer conversations into polished blog articles for Dev.to.

Given a conversation, extract the core technical insight and write a structured article.
Respond with ONLY a valid JSON object (no markdown fences) in this exact shape:
{
  "title": "A compelling, specific article title",
  "content": "Full article body in GitHub-flavored Markdown. Include an intro, headings, code blocks where appropriate, and a conclusion.",
  "tags": ["tag1", "tag2", "tag3"]
}

Tags must be valid Dev.to tags (lowercase, no spaces, max 4 tags).`,
    messages: [
      {
        role: 'user',
        content: `Here is the conversation to transform into an article:\n\n${conversationText}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const block = message.content[0];
  const raw = block?.type === 'text' ? block.text : '{}';

  const parsed = JSON.parse(raw) as GeneratedArticle;
  return {
    title: parsed.title ?? 'Untitled',
    content: parsed.content ?? '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : [],
  };
}
