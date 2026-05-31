import React, { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { selectedContactAtom } from '~/store/contacts';
import type { IContact } from '~/store/contacts';

interface Props {
  contact: IContact;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ContactCard({ contact, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const setSelectedContact = useSetRecoilState(selectedContactAtom);

  return (
    <div className="border-b border-border-light px-4 py-3 hover:bg-surface-hover">
      {/* Header row */}
      <div
        className="flex cursor-pointer items-start justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <div>
          <p className="text-sm font-medium text-text-primary">{contact.name}</p>
          {contact.company && (
            <p className="text-xs text-text-secondary">
              {contact.role ? `${contact.role} @ ` : ''}
              {contact.company}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedContact(contact)}
            className="text-xs text-purple-500 hover:underline"
            title="Ask AI about this contact"
          >
            Ask AI
          </button>
          <button
            onClick={onEdit}
            className="text-xs text-blue-500 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-500 hover:underline"
          >
            Del
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-1 text-xs text-text-secondary">
          {contact.email && <p>✉ {contact.email}</p>}
          {contact.notes && <p className="italic">{contact.notes}</p>}
          {contact.attributes?.map((a) => (
            <p key={a.key}>
              <span className="font-medium">{a.key}:</span> {a.value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}