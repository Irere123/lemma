import { describe, expect, test } from 'bun:test'

import { describeSchema, getContentSchema, schemaFingerprint } from '../src/schema'
import { SCHEMA_VERSION } from '../src/yjs'

/**
 * The fingerprint of the document model at each SCHEMA_VERSION. When this test
 * fails, the schema changed: bump SCHEMA_VERSION in src/yjs.ts, add a
 * migration for documents written in the old version (even an empty one), and
 * record the new fingerprint here. Never edit an existing entry.
 */
const FINGERPRINTS: Record<number, string> = {
  1: 'ec3f02e3',
  2: '3da1f680',
}

describe('schema contract', () => {
  test('a schema change comes with a SCHEMA_VERSION bump', () => {
    const actual = schemaFingerprint(getContentSchema())
    if (FINGERPRINTS[SCHEMA_VERSION] !== actual) {
      console.error(
        `Schema fingerprint is ${actual}, recorded for v${SCHEMA_VERSION}: ${FINGERPRINTS[SCHEMA_VERSION]}.\n` +
          'Bump SCHEMA_VERSION, add a migration, and record the new fingerprint.\n' +
          JSON.stringify(describeSchema(getContentSchema()), null, 2)
      )
    }
    expect(actual).toBe(FINGERPRINTS[SCHEMA_VERSION] as string)
  })

  test('every past version is recorded', () => {
    for (let version = 1; version <= SCHEMA_VERSION; version++) {
      expect(FINGERPRINTS[version]).toBeString()
    }
  })
})
