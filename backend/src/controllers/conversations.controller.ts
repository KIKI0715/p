import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Article } from '../models/Article';
import { chat, generateArticle, ChatMessage } from '../services/openai';

const MAX_MESSAGE_LENGTH = 4000;

export async function listConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversations = await Conversation.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

export async function createConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, tags } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const conversation = await Conversation.create({
      userId: req.userId,
      title: title.trim().slice(0, 200),
      tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : [],
    });
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    res.json({ ...conversation.toJSON(), messages });
  } catch (err) {
    next(err);
  }
}

export async function deleteConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    await Message.deleteMany({ conversationId: conversation._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
      return;
    }
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    await Message.create({ conversationId: conversation._id, role: 'user', content: content.trim() });

    const history = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    const chatHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

    let assistantContent: string;
    try {
      assistantContent = await chat(chatHistory);
    } catch {
      res.status(503).json({ error: 'AI service unavailable, please try again shortly.' });
      return;
    }

    const assistantMessage = await Message.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: assistantContent,
    });

    await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });

    res.status(201).json(assistantMessage);
  } catch (err) {
    next(err);
  }
}

export async function generateArticleFromConversation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const history = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    if (history.length === 0) {
      res.status(400).json({ error: 'Conversation has no messages to generate an article from' });
      return;
    }

    const chatHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

    let generated;
    try {
      generated = await generateArticle(chatHistory);
    } catch {
      res.status(503).json({ error: 'AI service unavailable, please try again shortly.' });
      return;
    }

    const article = await Article.create({
      userId: req.userId,
      conversationId: conversation._id,
      title: generated.title,
      content: generated.content,
      tags: generated.tags,
      status: 'draft',
    });

    res.status(201).json(article);
  } catch (err) {
    next(err);
  }
}
