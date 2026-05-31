const CONTACT_KEYWORDS = [
  'who', 'contact', 'works at', 'email', 'company', 'cto', 'ceo',
  'role', 'know about', 'tell me about', 'list all', 'people at',
  'colleagues', 'find', 'search',
];

export function isContactQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return CONTACT_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchContactContext(query: string): Promise<string> {
  try {
    const res = await fetch('/api/contacts/search-for-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, limit: 10 }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!data.contacts?.length) return '';

    const lines = data.contacts.map((c: Record<string, string>) =>
      Object.entries(c)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
    );

    return `[Relevant contacts from user's contact list:\n${lines.join('\n')}]\n\n`;
  } catch {
    return '';
  }
}