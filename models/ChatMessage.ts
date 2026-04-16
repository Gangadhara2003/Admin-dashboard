import mongoose, { Model } from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    senderRole: { type: String, enum: ['admin', 'supplier'], required: true },
    message: { type: String, required: true, trim: true },
    readByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ supplierId: 1, createdAt: 1 });

const ChatMessage: Model<any> = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;
