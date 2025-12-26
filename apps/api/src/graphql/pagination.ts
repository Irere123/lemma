export type ConnectionArgs = {
  first?: number | null
  after?: string | null
  last?: number | null
  before?: string | null
}

export type Edge<T> = {
  cursor: string
  node: T
}

export type PageInfo = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor: string | null
  endCursor: string | null
}

export type Connection<T> = {
  edges: Edge<T>[]
  nodes: T[]
  pageInfo: PageInfo
  totalCount: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export function encodeCursor(value: string | Date): string {
  const str = value instanceof Date ? value.toISOString() : value
  return Buffer.from(str).toString('base64')
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8')
}

export function getLimit(args: ConnectionArgs): number {
  const requestedLimit = args.first ?? args.last ?? DEFAULT_PAGE_SIZE
  return Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE)
}

export function getCursorValue(args: ConnectionArgs): string | null {
  if (args.after) {
    return decodeCursor(args.after)
  }
  if (args.before) {
    return decodeCursor(args.before)
  }
  return null
}

export function buildConnection<T extends { id: string; createdAt?: Date | null }>(
  items: T[],
  args: ConnectionArgs,
  totalCount: number,
  getCursorField: (item: T) => string | Date = (item) => item.createdAt ?? item.id
): Connection<T> {
  const limit = getLimit(args)

  // Determine if we fetched an extra item to check for more pages
  const hasExtraItem = items.length > limit
  const slicedItems = hasExtraItem ? items.slice(0, limit) : items

  const edges: Edge<T>[] = slicedItems.map((item) => ({
    cursor: encodeCursor(String(getCursorField(item))),
    node: item,
  }))

  const firstEdge = edges[0]
  const lastEdge = edges[edges.length - 1]

  const pageInfo: PageInfo = {
    hasNextPage: args.first ? hasExtraItem : false,
    hasPreviousPage: args.last ? hasExtraItem : args.after ? true : false,
    startCursor: firstEdge?.cursor ?? null,
    endCursor: lastEdge?.cursor ?? null,
  }

  return {
    edges,
    nodes: slicedItems,
    pageInfo,
    totalCount,
  }
}

export function buildConnectionFromCursor<T extends { id: string }>(
  items: T[],
  args: ConnectionArgs,
  totalCount: number,
  getCursorField: (item: T) => string
): Connection<T> {
  const limit = getLimit(args)

  // Determine if we fetched an extra item to check for more pages
  const hasExtraItem = items.length > limit
  const slicedItems = hasExtraItem ? items.slice(0, limit) : items

  const edges: Edge<T>[] = slicedItems.map((item) => ({
    cursor: encodeCursor(getCursorField(item)),
    node: item,
  }))

  const firstEdge = edges[0]
  const lastEdge = edges[edges.length - 1]

  const pageInfo: PageInfo = {
    hasNextPage: args.first ? hasExtraItem : false,
    hasPreviousPage: args.last ? hasExtraItem : args.after ? true : false,
    startCursor: firstEdge?.cursor ?? null,
    endCursor: lastEdge?.cursor ?? null,
  }

  return {
    edges,
    nodes: slicedItems,
    pageInfo,
    totalCount,
  }
}
