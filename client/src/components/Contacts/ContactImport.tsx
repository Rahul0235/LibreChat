import React, { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

async function importCsv(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/contacts-import', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
}

export default function ContactImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: importCsv,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['contacts']);
      alert(`Imported ${data.imported} contacts`);
    },
    onError: (err: Error) => alert(`Import failed: ${err.message}`),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    mutation.mutate(file);
    e.target.value = '';
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isLoading}
        className="rounded border border-border-medium px-3 py-1 text-xs hover:bg-surface-hover disabled:opacity-50"
      >
        {mutation.isLoading ? 'Importing…' : 'Import CSV'}
      </button>
    </>
  );
}