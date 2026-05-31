const express = require('express');
const multer  = require('multer');
const { Readable } = require('stream');
const csv     = require('csv-parser');
const router  = express.Router();
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

async function bulkImportContacts(userId, contacts) {
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const DIRECT_CORE = new Set(['name', 'company', 'role', 'email', 'notes']);
const SKIP_FIELDS = new Set(['id', 'chat_id', 'state_id', 'lead_id', 'message_id']);

router.post('/', contactsAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const contacts = [];
  const stream = Readable.from(req.file.buffer);

  stream
    .pipe(csv())
    .on('data', (row) => {
      const core = {};
      const attributes = [];

      const normalized = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k.trim().toLowerCase()] = String(v ?? '').trim();
      }

      if (normalized['name']) {
        core['name'] = normalized['name'];
      } else {

        const parts = [
          normalized['first_name'] || normalized['firstname'],
          normalized['middle_name'] || normalized['middlename'],
          normalized['last_name']   || normalized['lastname']  || normalized['surname'],
        ].filter(Boolean);
        if (parts.length > 0) core['name'] = parts.join(' ');
      }

      if (!core['name']) return;

      core['email']   = normalized['email']   || '';
      core['company'] = normalized['company'] || normalized['company_name'] || normalized['organization'] || '';
      core['role']    = normalized['role']    || normalized['designation']  || normalized['title']        || normalized['position'] || '';
      core['notes']   = normalized['notes']   || normalized['note']         || '';

      const usedKeys = new Set([
        'name', 'first_name', 'middle_name', 'last_name',
        'firstname', 'middlename', 'lastname', 'surname',
        'email', 'company', 'company_name', 'organization',
        'role', 'designation', 'title', 'position',
        'notes', 'note',
        ...SKIP_FIELDS,
      ]);

      for (const [k, v] of Object.entries(normalized)) {
        if (!usedKeys.has(k) && v && v !== '') {
          attributes.push({ key: k, value: v });
        }
      }

      contacts.push({ ...core, attributes });
    })
    .on('end', async () => {
      try {
        const result = await bulkImportContacts(req.user.id, contacts);
        res.json({ imported: result.inserted, total: contacts.length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    .on('error', (err) => res.status(400).json({ error: `CSV parse error: ${err.message}` }));
});

module.exports = router;