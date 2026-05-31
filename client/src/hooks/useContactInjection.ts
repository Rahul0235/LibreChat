// client/src/hooks/useContactInjection.ts
// Drop-in hook — call this before submitting a chat message.

import { useCallback } from 'react';
import { isContactQuery, fetchContactContext } from './useContactsContext';

export function useContactInjection() {
  const injectContacts = useCallback(async (messageText: string): Promise<string> => {
    if (!isContactQuery(messageText)) {
      return messageText;  
    }
    const context = await fetchContactContext(messageText);
    if (!context) return messageText;

    return `${context}${messageText}`;
  }, []);

  return { injectContacts };
}