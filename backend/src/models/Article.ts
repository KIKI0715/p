import { Schema, model, Document, Types } from 'mongoose';

export interface IArticle extends Document {
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  status: 'draft' | 'published';
  devtoId?: number;
  devtoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<IArticle>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    devtoId: { type: Number },
    devtoUrl: { type: String },
  },
  { timestamps: true }
);

export const Article = model<IArticle>('Article', articleSchema);
