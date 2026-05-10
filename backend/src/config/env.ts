import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/ai-blog',
  jwtSecret: process.env.JWT_SECRET ?? 'changeme',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
};
