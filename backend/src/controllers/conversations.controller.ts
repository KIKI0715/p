import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Article } from '../models/Article';
import { chat, generateArticle, ChatMessage } from '../services/openai';

export async function listConversations(req: AuthRequest, res: Response): Promise<void> {
  const conversations = await Conversation.find({ userId: req.userId }).sort({ updatedAt: -1 });
  res.json(conversations);
}

export async function createConversation(req: AuthRequest, res: Response): Promise<void> {
  const { title, tags } = req.body;
  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const conversation = await Conversation.create({
    userId: req.userId,
    title,
    tags: tags ?? [],
  });
  res.status(201).json(conversation);
}

export async function getConversation(req: AuthRequest, res: Response): Promise<void> {
  const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  res.json({ ...conversation.toJSON(), messages });
}

export async function deleteConversation(req: AuthRequest, res: Response): Promise<void> {
  const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  await Message.deleteMany({ conversationId: conversation._id });
  res.json({ message: 'Deleted' });
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  await Message.create({ conversationId: conversation._id, role: 'user', content });

  const history = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  const chatHistory: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

  const assistantContent = await chat(chatHistory);
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    role: 'assistant',
    content: assistantContent,
  });

  await Conversation.findByIdAndUpdate(conversation._id, { updatedAt: new Date() });

  res.status(201).json(assistantMessage);
}

export async function generateArticleFromConversation(req: AuthRequest, res: Response): Promise<void> {
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
  const generated = await generateArticle(chatHistory);

  const article = await Article.create({
    userId: req.userId,
    conversationId: conversation._id,
    title: generated.title,
    content: generated.content,
    tags: generated.tags,
    status: 'draft',
  });

  res.status(201).json(article);
}
