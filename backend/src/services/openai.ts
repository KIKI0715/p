import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

function sanitizeMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const cleaned = messages
    .map((msg): Anthropic.MessageParam | null => {
      if (typeof msg.content === 'string') {
        return msg.content.trim() ? (msg as Anthropic.MessageParam) : null;
      }
      // Array content: drop empty text blocks, keep tool_use / tool_result / etc.
      const cleanContent = msg.content.filter((block) => {
        if (block.type === 'text') {
          return block.text && block.text.trim().length > 0;
        }
        return true;
      });
      return cleanContent.length > 0 ? { ...msg, content: cleanContent } : null;
    })
    .filter((m): m is Anthropic.MessageParam => m !== null);

  // Anthropic requires strictly alternating user/assistant turns starting with user
  const result: Anthropic.MessageParam[] = [];
  for (const msg of cleaned) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      // Merge consecutive same-role string messages; drop same-role array messages
      if (typeof last.content === 'string' && typeof msg.content === 'string') {
        last.content += '\n\n' + msg.content;
      }
    } else {
      result.push({ ...msg });
    }
  }

  if (result[0]?.role === 'assistant') result.shift();

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
