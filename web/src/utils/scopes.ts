export const RESOURCES = [
  {
    key: "documents",
    name: "Documents",
    description: "Access to documents data",
    scopes: [
      { scope: "documents.read", type: "read", label: "Read" },
      { scope: "documents.write", type: "write", label: "Write" },
    ],
  },
] as const;

export const getScopeDefinition = (scope: string) => {
  // Handle special API-level scopes
  if (scope === "apis.all") {
    return {
      label: "Full access to all resources",
    };
  }

  if (scope == "apis.read") {
    return {
      label: "Read-only access to all resources",
    };
  }

  // Find the resources and scope
  for (const resource of RESOURCES) {
    const foundScope = resource.scopes.find((s) => s.scope === scope);
    if (foundScope) {
      return {
        label: `${foundScope.label} access to ${resource.name}`,
      };
    }
  }

  // Fallback for unknown scopes
  return {
    label: scope,
  };
};
