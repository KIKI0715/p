import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, name });
  const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
  res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
  res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
}

export async function updateProfile(req: Request & { userId?: string }, res: Response): Promise<void> {
  const { name, devtoApiKey } = req.body;
  const user = await User.findByIdAndUpdate(
    req.userId,
    { ...(name && { name }), ...(devtoApiKey !== undefined && { devtoApiKey }) },
    { new: true }
  );
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ id: user._id, email: user.email, name: user.name, hasDevtoKey: !!user.devtoApiKey });
}

export async function getProfile(req: Request & { userId?: string }, res: Response): Promise<void> {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ id: user._id, email: user.email, name: user.name, hasDevtoKey: !!user.devtoApiKey });
}
