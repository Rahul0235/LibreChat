import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IContact,
  IContactCreatePayload,
  IContactSearchParams,
  IContactsListResponse,
} from '../types/contacts';
import { contacts, contactById, contactsImport } from '../api-endpoints';

const QueryKeys = {
  contacts: 'contacts',
  contact:  'contact',
};

export const useContacts = (params: IContactSearchParams = {}) =>
  useQuery<IContactsListResponse>({
    queryKey: [QueryKeys.contacts, params],
    queryFn: async () => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      const res = await fetch(`${contacts}?${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load contacts');
      return res.json();
    },
    keepPreviousData: true,
    staleTime: 30_000,
  });

export const useContact = (id: string) =>
  useQuery<IContact>({
    queryKey: [QueryKeys.contact, id],
    queryFn: async () => {
      const res = await fetch(contactById(id), { credentials: 'include' });
      if (!res.ok) throw new Error('Contact not found');
      return res.json();
    },
    enabled: !!id,
  });

export const useCreateContact = () => {
  const qc = useQueryClient();
  return useMutation<IContact, Error, IContactCreatePayload>({
    mutationFn: async (payload) => {
      const res = await fetch(contacts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create contact');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries([QueryKeys.contacts]),
  });
};

export const useUpdateContact = () => {
  const qc = useQueryClient();
  return useMutation<IContact, Error, { id: string; payload: Partial<IContactCreatePayload> }>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(contactById(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update contact');
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries([QueryKeys.contacts]);
      qc.invalidateQueries([QueryKeys.contact, id]);
    },
  });
};

export const useDeleteContact = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(contactById(id), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete contact');
    },
    onSuccess: () => qc.invalidateQueries([QueryKeys.contacts]),
  });
};

export const useImportContacts = () => {
  const qc = useQueryClient();
  return useMutation<{ imported: number; total: number }, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(contactsImport, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error('Import failed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries([QueryKeys.contacts]),
  });
};