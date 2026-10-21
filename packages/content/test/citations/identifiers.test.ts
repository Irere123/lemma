import { describe, expect, test } from 'bun:test'

import { detectIdentifier, normalizeIsbn } from '../../src/citations'

describe('detectIdentifier', () => {
  test.each([
    ['10.1038/nature14539', '10.1038/nature14539'],
    ['doi:10.1038/nature14539', '10.1038/nature14539'],
    ['DOI: 10.1038/nature14539', '10.1038/nature14539'],
    ['https://doi.org/10.1038/nature14539', '10.1038/nature14539'],
    ['http://dx.doi.org/10.1038/nature14539', '10.1038/nature14539'],
    ['doi.org/10.1038/nature14539', '10.1038/nature14539'],
    ['https://doi.org/10.1002%2F%28SICI%291097-4636', '10.1002/(SICI)1097-4636'],
    ['10.1000/xyz123.', '10.1000/xyz123'],
    ['(10.1000/xyz123),', '10.1000/xyz123'],
    ['10.1016/S0140-6736(20)30183-5', '10.1016/S0140-6736(20)30183-5'],
    ['10.1016/S0140-6736(20)30183-5).', '10.1016/S0140-6736(20)30183-5'],
    ['<10.1000/abc>', '10.1000/abc'],
    ['10.48550/arXiv.2301.01234', '10.48550/arXiv.2301.01234'],
  ])('DOI %s', (input, value) => {
    expect(detectIdentifier(input)).toEqual({ kind: 'doi', value })
  })

  test.each([
    ['2301.01234', '2301.01234'],
    ['2301.01234v2', '2301.01234v2'],
    ['arXiv:2301.01234', '2301.01234'],
    ['arxiv: 1706.03762v7', '1706.03762v7'],
    ['0704.0001', '0704.0001'],
    ['hep-th/9901001', 'hep-th/9901001'],
    ['math.GT/0309136v1', 'math.GT/0309136v1'],
    ['https://arxiv.org/abs/2301.01234', '2301.01234'],
    ['https://arxiv.org/abs/2301.01234v3?context=cs', '2301.01234v3'],
    ['http://arxiv.org/pdf/2301.01234v1.pdf', '2301.01234v1'],
    ['https://arxiv.org/pdf/2301.01234', '2301.01234'],
    ['https://export.arxiv.org/abs/hep-th/9901001', 'hep-th/9901001'],
  ])('arXiv %s', (input, value) => {
    expect(detectIdentifier(input)).toEqual({ kind: 'arxiv', value })
  })

  test.each([
    ['978-0-306-40615-7', '9780306406157'],
    ['9780306406157', '9780306406157'],
    ['ISBN 978-0-306-40615-7', '9780306406157'],
    ['ISBN-13: 978 0 306 40615 7', '9780306406157'],
    ['0-306-40615-2', '9780306406157'],
    ['ISBN-10: 0306406152', '9780306406157'],
    ['0-8044-2957-X', '9780804429573'],
    ['080442957x', '9780804429573'],
  ])('ISBN %s', (input, value) => {
    expect(detectIdentifier(input)).toEqual({ kind: 'isbn', value })
  })

  test.each([
    ['https://www.nature.com/articles/nature14539', 'https://www.nature.com/articles/nature14539'],
    ['http://example.com/a?b=1#c', 'http://example.com/a?b=1#c'],
    [
      'https://en.wikipedia.org/wiki/Bracket_(disambiguation)',
      'https://en.wikipedia.org/wiki/Bracket_(disambiguation)',
    ],
    ['https://example.com/page.', 'https://example.com/page'],
    // Publisher URLs that merely contain a DOI stay URLs.
    [
      'https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1',
      'https://www.biorxiv.org/content/10.1101/2020.01.01.123456v1',
    ],
  ])('URL %s', (input, value) => {
    expect(detectIdentifier(input)).toEqual({ kind: 'url', value })
  })

  test.each([
    '',
    '   ',
    'hello world',
    'Smith 2020',
    '978-0-306-40615-8', // bad checksum
    '0-306-40615-3', // bad checksum
    '1234.5678', // month 34
    '2301.0123', // five digits are required since 2015
    '10.1/x', // registrant too short
    'ftp://example.com/file',
    'javascript:alert(1)',
    'example.com',
  ])('not an identifier: %p', (input) => {
    expect(detectIdentifier(input)).toBeNull()
  })

  test('normalizeIsbn converts ISBN-10 to ISBN-13', () => {
    expect(normalizeIsbn('0-19-852663-6')).toBe('9780198526636')
    expect(normalizeIsbn('979-10-90636-07-1')).toBe('9791090636071')
    expect(normalizeIsbn('979-10-90636-07-2')).toBeNull()
  })
})
