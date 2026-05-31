export const searchContactsTool = {
  type: 'function' as const,
  function: {
    name: 'search_contacts',
    description:
      'Search the user\'s contacts database. Use this whenever the user asks about people, ' +
      'companies, roles, or other information that may be stored in their contacts. ' +
      'Always call this tool before answering contact-related questions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language search query. Examples: "Acme Corp", "CTO", ' +
            '"AI infrastructure", "john@example.com"',
        },
        limit: {
          type: 'number',
          description: 'Max contacts to return (default 10, max 20)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
};