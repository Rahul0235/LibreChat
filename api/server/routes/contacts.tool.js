const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cookies = require('cookie');
const { Types, model, models, Schema } = require('mongoose');
const { contactsAuth } = require('./contacts');

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
const Contact = models['Contact'] || model('Contact', ContactSchema);

function formatContact(c) {
  return {
    name:    c.name    || '',
    company: c.company || '',
    role:    c.role    || '',
    email:   c.email   || '',
    notes:   c.notes   || '',
  };
}

function flexAuth(req, res, next) {

  const apiKey = req.headers['x-api-key'] || req.body?.api_key;
  if (apiKey && apiKey === process.env.CONTACTS_INTERNAL_KEY) {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required when using api_key' });
    }
    req.user = { id: userId };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id || decoded.sub };
      return next();
    } catch { /* fall through */ }
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parsed = cookies.parse(cookieHeader);
    const token = parsed.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        req.user = { id: decoded.id || decoded.sub };
        return next();
      } catch { /* fall through */ }
    }
  }

  return res.status(401).json({ message: 'No auth token' });
}

async function searchByText(userId, query, limit = 10) {
  const contacts = await Contact.find({
    userId: new Types.ObjectId(userId),
    $text: { $search: query },
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(Math.min(limit, 10))
    .select('name company role email notes')
    .lean();
  return contacts.map(formatContact);
}

async function searchByCompany(userId, company, limit = 10) {
  const contacts = await Contact.find({
    userId:  new Types.ObjectId(userId),
    company: { $regex: company, $options: 'i' },
  })
    .sort({ name: 1 })
    .limit(Math.min(limit, 10))
    .select('name company role email notes')
    .lean();
  return contacts.map(formatContact);
}

async function searchByRole(userId, role, limit = 10) {
  const contacts = await Contact.find({
    userId: new Types.ObjectId(userId),
    role:   { $regex: role, $options: 'i' },
  })
    .sort({ name: 1 })
    .limit(Math.min(limit, 10))
    .select('name company role email notes')
    .lean();
  return contacts.map(formatContact);
}

async function searchByName(userId, name, limit = 10) {
  const contacts = await Contact.find({
    userId: new Types.ObjectId(userId),
    name:   { $regex: name, $options: 'i' },
  })
    .sort({ name: 1 })
    .limit(Math.min(limit, 10))
    .select('name company role email notes')
    .lean();
  return contacts.map(formatContact);
}

async function searchByAttribute(userId, key, value, limit = 10) {
  const contacts = await Contact.find({
    userId: new Types.ObjectId(userId),
    attributes: {
      $elemMatch: {
        key:   { $regex: key,   $options: 'i' },
        value: { $regex: value, $options: 'i' },
      },
    },
  })
    .sort({ name: 1 })
    .limit(Math.min(limit, 10))
    .select('name company role email notes')
    .lean();
  return contacts.map(formatContact);
}

async function listAll(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [contacts, total] = await Promise.all([
    Contact.find({ userId: new Types.ObjectId(userId) })
      .sort({ name: 1 })
      .skip(skip)
      .limit(Math.min(limit, 10))
      .select('name company role email notes')
      .lean(),
    Contact.countDocuments({ userId: new Types.ObjectId(userId) }),
  ]);
  return {
    contacts: contacts.map(formatContact),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

router.post('/search-for-chat', contactsAuth, async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }
    const results = await searchByText(req.user.id, query, limit);
    res.json({ contacts: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lookup', flexAuth, async (req, res) => {
  try {
    const { type, query, key, value, page = 1, limit = 10 } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    let result;

    switch (type) {
      case 'text':
        if (!query) return res.status(400).json({ error: 'query required for text search' });
        result = { contacts: await searchByText(req.user.id, query, limit) };
        break;
      case 'company':
        if (!query) return res.status(400).json({ error: 'query required for company search' });
        result = { contacts: await searchByCompany(req.user.id, query, limit) };
        break;
      case 'role':
        if (!query) return res.status(400).json({ error: 'query required for role search' });
        result = { contacts: await searchByRole(req.user.id, query, limit) };
        break;
      case 'name':
        if (!query) return res.status(400).json({ error: 'query required for name search' });
        result = { contacts: await searchByName(req.user.id, query, limit) };
        break;
      case 'attribute':
        if (!key || !value) return res.status(400).json({ error: 'key and value required' });
        result = { contacts: await searchByAttribute(req.user.id, key, value, limit) };
        break;
      case 'all':
        result = await listAll(req.user.id, page, limit);
        break;
      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    result.count = result.contacts.length;
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats endpoint
router.post('/lookup/stats', flexAuth, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user.id);
    const [total, companies, roles] = await Promise.all([
      Contact.countDocuments({ userId }),
      Contact.distinct('company', { userId, company: { $ne: '' } }),
      Contact.distinct('role',    { userId, role:    { $ne: '' } }),
    ]);
    res.json({
      total,
      uniqueCompanies: companies.length,
      uniqueRoles:     roles.length,
      topCompanies:    companies.slice(0, 10),
      topRoles:        roles.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/openapi.json', (req, res) => {
  res.json(require('./contacts.openapi.json'));
});

module.exports = router;