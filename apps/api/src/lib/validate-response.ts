import { z } from 'zod/v4'
import type { core } from 'zod/v4'

type SchemaType<T> = z.ZodObject<core.$ZodShape, core.$strip> & {
  _zod: { output: T }
}

export const validateResponse = (data: any, schema: SchemaType<any>) => {
  const result = schema.safeParse(data)

  if (!result.success) {
    const cause = z.treeifyError(result.error)

    console.error(cause)

    return {
      success: false,
      error: 'Response validation failed',
      details: cause,
      data: null,
    }
  }

  return result.data
}
