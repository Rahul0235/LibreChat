import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IContact } from '~/store/contacts';

interface Props {
  contact?: IContact | null;
  onClose: () => void;
}

async function saveContact(contact: IContact | null | undefined, form: Partial<IContact>) {
  const url = contact?._id ? `/api/contacts/${contact._id}` : '/api/contacts';
  const method = contact?._id ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Failed to save contact');
  return res.json();
}

export default function ContactForm({ contact, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name:       contact?.name       ?? '',
    company:    contact?.company    ?? '',
    role:       contact?.role       ?? '',
    email:      contact?.email      ?? '',
    notes:      contact?.notes      ?? '',
    attributes: contact?.attributes ?? [] as { key: string; value: string }[],
  });

  const mutation = useMutation({
    mutationFn: () => saveContact(contact, form),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      onClose();
    },
  });

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const addAttr = () =>
    setForm((f) => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }));
  const setAttr = (i: number, k: 'key' | 'value', v: string) =>
    setForm((f) => {
      const attrs = [...f.attributes];
      attrs[i] = { ...attrs[i], [k]: v };
      return { ...f, attributes: attrs };
    });
  const removeAttr = (i: number) =>
    setForm((f) => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-surface-primary p-6 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold">{contact ? 'Edit' : 'New'} Contact</h3>

        {(['name', 'company', 'role', 'email'] as const).map((field) => (
          <input
            key={field}
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            value={form[field]}
            onChange={(e) => setField(field, e.target.value)}
            className="mb-2 w-full rounded border border-border-medium bg-surface-secondary
                       px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ))}

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          className="mb-3 w-full rounded border border-border-medium bg-surface-secondary
                     px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <p className="mb-1 text-xs font-medium text-text-secondary">Custom Attributes</p>
        {form.attributes.map((a, i) => (
          <div key={i} className="mb-1 flex gap-2">
            <input
              placeholder="Key"
              value={a.key}
              onChange={(e) => setAttr(i, 'key', e.target.value)}
              className="w-1/3 rounded border border-border-medium bg-surface-secondary px-2 py-1 text-xs"
            />
            <input
              placeholder="Value"
              value={a.value}
              onChange={(e) => setAttr(i, 'value', e.target.value)}
              className="flex-1 rounded border border-border-medium bg-surface-secondary px-2 py-1 text-xs"
            />
            <button onClick={() => removeAttr(i)} className="text-xs text-red-400">✕</button>
          </div>
        ))}
        <button onClick={addAttr} className="mb-4 text-xs text-blue-500 hover:underline">
          + Add attribute
        </button>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-1.5 text-xs hover:bg-surface-hover">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.name.trim() || mutation.isLoading}
            className="rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {contact ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}