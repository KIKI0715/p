import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Article } from '../models/Article';
import { User } from '../models/User';
import { publishArticle } from '../services/devto';

export async function listArticles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const articles = await Article.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(articles);
  } catch (err) {
    next(err);
  }
}

export async function getArticle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const article = await Article.findOne({ _id: req.params.id, userId: req.userId });
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json(article);
  } catch (err) {
    next(err);
  }
}

export async function updateArticle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, content, tags } = req.body;
    const article = await Article.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      {
        ...(title && { title: String(title).slice(0, 500) }),
        ...(content && { content: String(content) }),
        ...(Array.isArray(tags) && { tags: tags.map(String).slice(0, 4) }),
      },
      { new: true }
    );
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json(article);
  } catch (err) {
    next(err);
  }
}

export async function deleteArticle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const article = await Article.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

export async function publishToDev(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
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
    const apiKey = user?.getDecryptedDevtoApiKey();
    if (!apiKey) {
      res.status(400).json({ error: 'No Dev.to API key configured. Update your profile first.' });
      return;
    }

    let result;
    try {
      result = await publishArticle(apiKey, article.title, article.content, article.tags);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        res.status(400).json({ error: 'Dev.to rejected the request: invalid API key.' });
      } else if (status === 422) {
        res.status(400).json({ error: 'Dev.to rejected the article content. Check the title and tags.' });
      } else {
        res.status(502).json({ error: 'Dev.to is unavailable, please try again later.' });
      }
      return;
    }

    article.status = 'published';
    article.devtoId = result.id;
    article.devtoUrl = result.url;
    await article.save();

    res.json(article);
  } catch (err) {
    next(err);
  }
}
