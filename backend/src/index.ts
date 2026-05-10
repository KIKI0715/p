import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversations.routes';
import articleRoutes from './routes/articles.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/articles', articleRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

mongoose
  .connect(env.mongodbUri)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
