import { Schema, model, Document } from 'mongoose';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  devtoApiKey?: string;
  createdAt: Date;
  getDecryptedDevtoApiKey(): string | undefined;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    devtoApiKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.pre('save', function (next) {
  if (this.isModified('devtoApiKey') && this.devtoApiKey && !isEncrypted(this.devtoApiKey)) {
    this.devtoApiKey = encrypt(this.devtoApiKey);
  }
  next();
});

userSchema.methods.getDecryptedDevtoApiKey = function (): string | undefined {
  if (!this.devtoApiKey) return undefined;
  try {
    return isEncrypted(this.devtoApiKey) ? decrypt(this.devtoApiKey) : this.devtoApiKey;
  } catch {
    return undefined;
  }
};

export const User = model<IUser>('User', userSchema);
