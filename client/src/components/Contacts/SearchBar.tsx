// client/src/components/Contacts/SearchBar.tsx
import React from 'react';

interface Props { value: string; onChange: (v: string) => void; }

export default function SearchBar({ value, onChange }: Props) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search contacts…"
      className="w-full rounded border border-border-medium bg-surface-secondary
                 px-3 py-1.5 text-xs placeholder-text-secondary focus:outline-none
                 focus:ring-1 focus:ring-blue-500"
    />
  );
}