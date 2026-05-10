import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Article } from '../models/Article';
import { User } from '../models/User';
import { publishArticle } from '../services/devto';

export async function listArticles(req: AuthRequest, res: Response): Promise<void> {
  const articles = await Article.find({ userId: req.userId }).sort({ updatedAt: -1 });
  res.json(articles);
}

export async function getArticle(req: AuthRequest, res: Response): Promise<void> {
  const article = await Article.findOne({ _id: req.params.id, userId: req.userId });
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json(article);
}

export async function updateArticle(req: AuthRequest, res: Response): Promise<void> {
  const { title, content, tags } = req.body;
  const article = await Article.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { ...(title && { title }), ...(content && { content }), ...(tags && { tags }) },
    { new: true }
  );
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json(article);
}

export async function deleteArticle(req: AuthRequest, res: Response): Promise<void> {
  const article = await Article.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json({ message: 'Deleted' });
}

export async function publishToDev(req: AuthRequest, res: Response): Promise<void> {
  const article = await Article.findOne({ _id: req.params.id, userId: req.userId });
  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  if (article.status === 'published') {
    res.status(409).json({ error: 'Article already published' });
    return;
  }

  const user = await User.findById(req.userId);
  if (!user?.devtoApiKey) {
    res.status(400).json({ error: 'No Dev.to API key configured. Update your profile first.' });
    return;
  }

  const result = await publishArticle(user.devtoApiKey, article.title, article.content, article.tags);

  article.status = 'published';
  article.devtoId = result.id;
  article.devtoUrl = result.url;
  await article.save();

  res.json(article);
}
