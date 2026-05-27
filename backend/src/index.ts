import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversations.routes';
import articleRoutes from './routes/articles.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached, please wait a moment.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations/:id/messages', aiLimiter);
app.use('/api/conversations/:id/generate-article', aiLimiter);
app.use('/api/articles', articleRoutes);

let dbReady = false;

app.get('/health', (_req, res) => res.json({ status: 'ok', db: dbReady ? 'connected' : 'connecting' }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
  mongoose
    .connect(env.mongodbUri)
    .then(() => {
      dbReady = true;
      console.log('MongoDB connected');
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
});
