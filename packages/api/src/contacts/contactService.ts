import { FilterQuery, Types, Document, Schema, model, models } from 'mongoose';


interface IContactAttribute {
  key: string;
  value: string;
}

export interface IContactDocument extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes: IContactAttribute[];
  createdAt: Date;
  updatedAt: Date;
}

interface IContactCreatePayload {
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: IContactAttribute[];
}

interface IContactSearchParams {
  query?: string;
  company?: string;
  role?: string;
  page?: number;
  limit?: number;
}


const AttributeSchema = new Schema(
  {
    key:   { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

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
    name:                'text',
    company:             'text',
    role:                'text',
    email:               'text',
    notes:               'text',
    'attributes.value':  'text',
  },
  { name: 'contact_text_idx', weights: { name: 10, company: 8, role: 5 } },
);
ContactSchema.index({ userId: 1, createdAt: -1 });
ContactSchema.index({ userId: 1, company: 1 });

const Contact = (models['Contact'] ?? model<any>('Contact', ContactSchema));

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

export async function listContacts(userId: string, params: IContactSearchParams = {}) {
  const {
    query,
    company,
    role,
    page = 1,
    limit: rawLimit = DEFAULT_PAGE_LIMIT,
  } = params;

  const limit = Math.min(rawLimit, MAX_PAGE_LIMIT);
  const skip  = (page - 1) * limit;

  const filter: FilterQuery<IContactDocument> = {
    userId: new Types.ObjectId(userId),
  };

  if (query)   filter['$text']   = { $search: query };
  if (company) filter['company'] = { $regex: company, $options: 'i' };
  if (role)    filter['role']    = { $regex: role,    $options: 'i' };

  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contact.countDocuments(filter),
  ]);

  return { contacts, total, page, pages: Math.ceil(total / limit) };
}

export async function getContactById(userId: string, contactId: string) {
  return Contact.findOne({
    _id:    new Types.ObjectId(contactId),
    userId: new Types.ObjectId(userId),
  }).lean();
}

export async function createContact(userId: string, payload: IContactCreatePayload) {
  const doc = new Contact({ ...payload, userId: new Types.ObjectId(userId) });
  return doc.save();
}

export async function updateContact(
  userId: string,
  contactId: string,
  payload: Partial<IContactCreatePayload>,
) {
  return Contact.findOneAndUpdate(
    { _id: new Types.ObjectId(contactId), userId: new Types.ObjectId(userId) },
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();
}

export async function deleteContact(userId: string, contactId: string) {
  return Contact.deleteOne({
    _id:    new Types.ObjectId(contactId),
    userId: new Types.ObjectId(userId),
  });
}

export async function bulkImportContacts(
  userId: string,
  contacts: IContactCreatePayload[],
) {
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE).map((c) => ({
      ...c,
      userId: new Types.ObjectId(userId),
    }));
    const result = await Contact.insertMany(batch, { ordered: false });
    inserted += result.length;
  }

  return { inserted };
}

export async function searchContactsForAssistant(
  userId: string,
  query: string,
  limit = 10,
) {
  const filter: FilterQuery<IContactDocument> = {
    userId: new Types.ObjectId(userId),
    $text:  { $search: query },
  };

  const contacts = await Contact.find(filter)
    .sort({ score: { $meta: 'textScore' } })
    .limit(Math.min(limit, 20))
    .select('name company role email notes attributes')
    .lean();

  return contacts.map((c) => ({
  name:    c.name as string,
  company: c.company as string | undefined,
  role:    c.role    as string | undefined,
  email:   c.email   as string | undefined,
  notes:   c.notes   as string | undefined,

  ...Object.fromEntries(
    ((c.attributes ?? []) as IContactAttribute[]).map((a) => [a.key, a.value]),
  ),
}));
}