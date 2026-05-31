import { Schema, Document, model, models } from 'mongoose';

export interface IContactDocument extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes: { key: string; value: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const AttributeSchema = new Schema(
  {
    key:   { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// ✅ Remove the generic type parameter — use plain Schema()
const ContactSchema = new Schema(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:       { type: String, required: true, trim: true },
    company:    { type: String, trim: true, default: '' },
    role:       { type: String, trim: true, default: '' },
    email:      { type: String, trim: true, lowercase: true, default: '' },
    notes:      { type: String, default: '' },
    attributes: { type: [AttributeSchema], default: [] },
  },
  { timestamps: true },
);

ContactSchema.index(
  {
    name:               'text',
    company:            'text',
    role:               'text',
    email:              'text',
    notes:              'text',
    'attributes.value': 'text',
  },
  { name: 'contact_text_idx', weights: { name: 10, company: 8, role: 5 } },
);

ContactSchema.index({ userId: 1, createdAt: -1 });
ContactSchema.index({ userId: 1, company: 1 });

export const Contact = models.Contact || model<IContactDocument>('Contact', ContactSchema);