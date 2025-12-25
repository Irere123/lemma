export const RESOURCES = [
  {
    key: 'documents',
    name: 'Documents',
    description: 'Access to documents data',
    scopes: [
      { scope: 'documents.read', type: 'read', label: 'Read' },
      { scope: 'documents.write', type: 'write', label: 'Write' },
    ],
  },
  {
    key: 'users',
    name: 'Users',
    description: 'Access to users data',
    scopes: [
      { scope: 'users.read', type: 'read', label: 'Read' },
      { scope: 'users.write', type: 'write', label: 'Write' },
    ],
  },
  {
    key: 'search',
    name: 'Search',
    description: 'Access to search functionality',
    scopes: [{ scope: 'search.read', type: 'read', label: 'Read' }],
  },
  {
    key: 'tags',
    name: 'Tags',
    description: 'Access to tags data',
    scopes: [
      { scope: 'tags.read', type: 'read', label: 'Read' },
      { scope: 'tags.write', type: 'write', label: 'Write' },
    ],
  },
] as const

export const getScopeDescription = (scope: string) => {
  // Handle special API-level scopes
  if (scope === 'apis.all') {
    return {
      label: 'Full access to all resources',
    }
  }

  if (scope === 'apis.read') {
    return {
      label: 'Read-only access to all resources',
    }
  }

  // Find the resource and scope
  for (const resource of RESOURCES) {
    const foundScope = resource.scopes.find((s) => s.scope === scope)
    if (foundScope) {
      return {
        label: `${foundScope.label} access to ${resource.name}`,
      }
    }
  }

  // Fallback for unknown scopes
  return {
    label: scope,
  }
}
