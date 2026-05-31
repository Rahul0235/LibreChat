const express = require('express');
const router = express.Router();
const { Types, model, models, Schema } = require('mongoose');
const jwt = require('jsonwebtoken');

function extractToken(req) {

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  if (req.cookies && req.cookies.refreshToken) {
    return req.cookies.refreshToken;
  }
  return null;
}

function contactsAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'No auth token' });
  }
  try {
    const secret = process.env.JWT_SECRET || process.env.CREDS_KEY;
    const decoded = jwt.verify(token, secret);
    req.user = { id: decoded.id || decoded.sub || decoded._id };
    return next();
  } catch (err) {

    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET;
      const decoded = jwt.verify(token, refreshSecret);
      req.user = { id: decoded.id || decoded.sub || decoded._id };
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
}


const AttributeSchema = new Schema(
  { key: { type: String }, value: { type: String } },
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
  { name: 'text', company: 'text', role: 'text',
    email: 'text', notes: 'text', 'attributes.value': 'text' },
  { name: 'contact_text_idx', weights: { name: 10, company: 8, role: 5 } },
);
ContactSchema.index({ userId: 1, createdAt: -1 });
ContactSchema.index({ userId: 1, company: 1 });

const Contact = models['Contact'] || model('Contact', ContactSchema);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function listContacts(userId, params = {}) {
  const { query, company, role, page = 1, limit: rawLimit = DEFAULT_LIMIT } = params;
  const limit = Math.min(Number(rawLimit), MAX_LIMIT);
  const skip  = (Number(page) - 1) * limit;
  const filter = { userId: new Types.ObjectId(userId) };
  if (query)   filter['$text']   = { $search: query };
  if (company) filter['company'] = { $regex: company, $options: 'i' };
  if (role)    filter['role']    = { $regex: role,    $options: 'i' };
  const [contacts, total] = await Promise.all([
    Contact.find(filter)
      .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter),
  ]);
  return { contacts, total, page: Number(page), pages: Math.ceil(total / limit) };
}

async function getContactById(userId, contactId) {
  return Contact.findOne({
    _id: new Types.ObjectId(contactId),
    userId: new Types.ObjectId(userId),
  }).lean();
}

async function createContact(userId, payload) {
  const doc = new Contact({ ...payload, userId: new Types.ObjectId(userId) });
  return doc.save();
}

async function updateContact(userId, contactId, payload) {
  return Contact.findOneAndUpdate(
    { _id: new Types.ObjectId(contactId), userId: new Types.ObjectId(userId) },
    { $set: payload },
    { new: true, runValidators: true },
  ).lean();
}

async function deleteContact(userId, contactId) {
  return Contact.deleteOne({
    _id: new Types.ObjectId(contactId),
    userId: new Types.ObjectId(userId),
  });
}


router.get('/',      contactsAuth, async (req, res) => {
  try { res.json(await listContacts(req.user.id, req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id',   contactsAuth, async (req, res) => {
  try {
    const contact = await getContactById(req.user.id, req.params.id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json(contact);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/',     contactsAuth, async (req, res) => {
  try {
    const contact = await createContact(req.user.id, req.body);
    res.status(201).json(contact);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', contactsAuth, async (req, res) => {
  try {
    const contact = await updateContact(req.user.id, req.params.id, req.body);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json(contact);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', contactsAuth, async (req, res) => {
  try {
    await deleteContact(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.contactsAuth = contactsAuth;