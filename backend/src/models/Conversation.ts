import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  userId: Types.ObjectId;
  title: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

export const Conversation = model<IConversation>('Conversation', conversationSchema);
