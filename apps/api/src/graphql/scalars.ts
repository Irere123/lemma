import { GraphQLScalarType, Kind } from 'graphql'

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'A date-time string in ISO 8601 format',
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString()
    }
    throw new Error('DateTime cannot represent non-date value')
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string') {
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        throw new Error('DateTime cannot represent invalid date string')
      }
      return date
    }
    if (value instanceof Date) {
      return value
    }
    throw new Error('DateTime cannot represent non-string value')
  },
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value)
      if (isNaN(date.getTime())) {
        throw new Error('DateTime cannot represent invalid date string')
      }
      return date
    }
    throw new Error('DateTime cannot represent non-string value')
  },
})

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize(value: unknown): unknown {
    return value
  },
  parseValue(value: unknown): unknown {
    return value
  },
  parseLiteral(ast): unknown {
    switch (ast.kind) {
      case Kind.STRING:
        return ast.value
      case Kind.BOOLEAN:
        return ast.value
      case Kind.INT:
        return parseInt(ast.value, 10)
      case Kind.FLOAT:
        return parseFloat(ast.value)
      case Kind.OBJECT: {
        const value: Record<string, unknown> = {}
        ast.fields.forEach((field) => {
          value[field.name.value] = JSONScalar.parseLiteral(field.value)
        })
        return value
      }
      case Kind.LIST:
        return ast.values.map((v) => JSONScalar.parseLiteral(v))
      case Kind.NULL:
        return null
      default:
        return null
    }
  },
})
