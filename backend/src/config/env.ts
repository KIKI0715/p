import dotenv from 'dotenv';
dotenv.config();

function required(key: string, minLength = 0): string {
  const val = process.env[key];
  if (!val || val.length < minLength) {
    console.error(
      `FATAL: env var "${key}" is ${!val ? 'missing' : `too short (min ${minLength} chars)`}. Set it in backend/.env and restart.`
    );
    process.exit(1);
  }
  return val;
}

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/ai-blog',
  jwtSecret: required('JWT_SECRET', 32),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  openaiApiKey: required('OPENAI_API_KEY', 10),
  encryptionKey: required('ENCRYPTION_KEY', 32),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://10.0.2.2:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
