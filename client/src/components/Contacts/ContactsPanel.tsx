import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { IContact } from '~/store/contacts';
import ContactCard from './ContactCard';
import ContactForm from './ContactForm';
import ContactImport from './ContactImport';
import SearchBar from './SearchBar';

async function fetchContacts(query: string, page: number) {
  const qs = new URLSearchParams({
    ...(query ? { query } : {}),
    page: String(page),
    limit: '20',
  }).toString();
  const res = await fetch(`/api/contacts?${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load contacts');
  return res.json();
}

async function deleteContactApi(id: string) {
  const res = await fetch(`/api/contacts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete contact');
}

export default function ContactsPanel() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<IContact | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', query, page],
    queryFn: () => fetchContacts(query, page),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContactApi,
    onSuccess: () => queryClient.invalidateQueries(['contacts']),
  });

  return (
    <div className="flex h-full flex-col bg-surface-primary text-text-primary">
      <div className="flex items-center justify-between border-b border-border-medium px-4 py-3">
        <h2 className="text-sm font-semibold">Contacts</h2>
        <div className="flex gap-2">
          <ContactImport />
          <button
            onClick={() => { setEditContact(null); setShowForm(true); }}
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
          >
            + New
          </button>
        </div>
      </div>
      <div className="px-4 py-2">
        <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(1); }} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-4 py-6 text-center text-xs text-text-secondary">Loading…</p>
        )}
        {!isLoading && data?.contacts?.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-text-secondary">No contacts found.</p>
        )}
        {data?.contacts?.map((c: IContact) => (
          <ContactCard
            key={c._id}
            contact={c}
            onEdit={() => { setEditContact(c); setShowForm(true); }}
            onDelete={() => deleteMutation.mutate(c._id!)}
          />
        ))}
      </div>
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2 border-t border-border-medium py-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>&lt;</button>
          <span>{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>&gt;</button>
        </div>
      )}
      {showForm && (
        <ContactForm contact={editContact} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}