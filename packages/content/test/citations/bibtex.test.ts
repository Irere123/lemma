import { describe, expect, test } from 'bun:test'

import { decodeLatex, parseBibTeX } from '../../src/citations'

// A Zotero / Better BibTeX style export with the usual mix of entry types,
// plus hand-written entries with macros, quotes and TeX accents.
const LIBRARY =
  String.raw`
% Exported by Zotero — do not edit
@string{jmlr = {Journal of Machine Learning Research}}

@article{smith2020deep,
  title = {The {Deep} {Learning} Revolution},
  author = {Smith, John and Jones, Jane and Lee, Kim},
  year = {2020},
  month = mar,
  journal = jmlr,
  volume = {12},
  number = {3},
  pages = {45--67},
  doi = {10.1000/jmlr.2020.123},
  urldate = {2024-01-10},
  abstract = {We show that\ldots{} 50\% of models},
  langid = {english},
  keywords = {deep learning,neural networks},
  file = {/Users/x/Zotero/storage/ABC/smith.pdf}
}

@book{knuth1997art,
  title = {The Art of Computer Programming},
  author = {Knuth, Donald E.},
  year = {1997},
  edition = {3},
  publisher = {Addison-Wesley},
  address = {Reading, MA},
  isbn = {978-0-201-89683-1}
}

@incollection{brown2018neural,
  title = {Neural Networks in Practice},
  booktitle = {Handbook of Artificial Intelligence},
  author = {Brown, Alice},
  editor = {Green, Peter and White, Sarah},
  year = {2018},
  pages = {101--125},
  publisher = {Springer},
  address = {Berlin},
  doi = {10.1007/978-3-319-00000-0_5}
}

@inproceedings{muller2019uber,
  title = {{\"U}ber die {Analyse} von {Stra\ss enverkehr}},
  booktitle = {Proceedings of the 12th {International} {Conference} on {Traffic}},
  author = {M{\"u}ller, J{\"o}rg and Gonz{\'a}lez, Mar{\'\i}a and {\O}rsted, Hans Christian},
  year = {2019},
  pages = {1--10},
  publisher = {ACM},
  address = {New York, NY, USA},
  doi = {https://doi.org/10.1145/3292500.3330701}
}

@phdthesis{garcia2019learning,
  title = {Learning to See in the Dark},
  author = {Garc{\'i}a, Mar{\'i}a},
  year = {2019},
  school = {Stanford University},
  url = {https://purl.stanford.edu/abc123}
}

@techreport{who2021global,
  title = {Global Report on Infection Prevention and Control},
  author = {{World Health Organization}},
  year = {2021},
  number = {12},
  institution = {World Health Organization},
  address = {Geneva},
  url = {https://www.who.int/publications/i/item/9789240051164}
}

@online{doe2023how,
  title = {How Transformers Work},
  author = {Doe, Jane},
  date = {2023-05-14},
  url = {https://thegradient.pub/transformers},
  urldate = {2024-01-10},
  organization = {The Gradient}
}

@misc{vaswani2017attention,
  title = {Attention Is All You Need},
  author = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
  year = {2017},
  number = {arXiv:1706.03762},
  eprint = {1706.03762},
  archiveprefix = {arxiv},
  primaryclass = {cs},
  publisher = {arXiv},
  doi = {10.48550/arXiv.1706.03762},
}

@mastersthesis{beethoven1800sonatas,
  author = "Ludwig van Beethoven and King, Jr., Martin Luther",
  title = "Sonatas --- and ` +
  "``quotes''" +
  String.raw` -- ranges",
  school = "Universit{\"a}t Wien",
  year = 1800,
  month = "December"
}

@misc{page2022,
  title = {A {Simple} Page},
  howpublished = {\url{https://example.com/page_one}},
  year = {2022}
}

@unpublished{lee2024draft,
  title = {Draft on {$\alpha$}-Helices \& {$\beta$}-Sheets},
  author = {Lee, Kim and {Barnes and Noble, Inc.}},
  note = {Manuscript in preparation},
  year = {in press}
}

@comment{jabref-meta: databaseType:bibtex;}
`

describe('parseBibTeX: a realistic library', () => {
  const { items, warnings } = parseBibTeX(LIBRARY)
  const byId = new Map(items.map((i) => [i.id, i]))

  test('reads every entry, keeping the keys', () => {
    expect(warnings).toEqual([])
    expect(items.map((i) => [i.id, i.type])).toEqual([
      ['smith2020deep', 'article-journal'],
      ['knuth1997art', 'book'],
      ['brown2018neural', 'chapter'],
      ['muller2019uber', 'paper-conference'],
      ['garcia2019learning', 'thesis'],
      ['who2021global', 'report'],
      ['doe2023how', 'webpage'],
      ['vaswani2017attention', 'article'],
      ['beethoven1800sonatas', 'thesis'],
      ['page2022', 'webpage'],
      ['lee2024draft', 'manuscript'],
    ])
  })

  test('journal article fields', () => {
    expect(byId.get('smith2020deep')).toEqual({
      id: 'smith2020deep',
      type: 'article-journal',
      title: 'The Deep Learning Revolution',
      'container-title': 'Journal of Machine Learning Research',
      author: [
        { family: 'Smith', given: 'John' },
        { family: 'Jones', given: 'Jane' },
        { family: 'Lee', given: 'Kim' },
      ],
      issued: { 'date-parts': [[2020, 3]] },
      accessed: { 'date-parts': [[2024, 1, 10]] },
      volume: '12',
      issue: '3',
      page: '45-67',
      DOI: '10.1000/jmlr.2020.123',
      abstract: 'We show that… 50% of models',
      language: 'english',
    })
  })

  test('book, chapter and conference paper', () => {
    expect(byId.get('knuth1997art')).toMatchObject({
      edition: '3',
      publisher: 'Addison-Wesley',
      'publisher-place': 'Reading, MA',
      ISBN: '978-0-201-89683-1',
    })
    expect(byId.get('brown2018neural')).toMatchObject({
      'container-title': 'Handbook of Artificial Intelligence',
      editor: [
        { family: 'Green', given: 'Peter' },
        { family: 'White', given: 'Sarah' },
      ],
      page: '101-125',
    })
    expect(byId.get('muller2019uber')).toMatchObject({
      title: 'Über die Analyse von Straßenverkehr',
      'container-title': 'Proceedings of the 12th International Conference on Traffic',
      author: [
        { family: 'Müller', given: 'Jörg' },
        { family: 'González', given: 'María' },
        { family: 'Ørsted', given: 'Hans Christian' },
      ],
      DOI: '10.1145/3292500.3330701',
      page: '1-10',
    })
  })

  test('theses, reports, web pages and preprints', () => {
    expect(byId.get('garcia2019learning')).toMatchObject({
      author: [{ family: 'García', given: 'María' }],
      genre: 'PhD thesis',
      publisher: 'Stanford University',
    })
    expect(byId.get('who2021global')).toMatchObject({
      author: [{ literal: 'World Health Organization' }],
      number: '12',
      publisher: 'World Health Organization',
      'publisher-place': 'Geneva',
    })
    expect(byId.get('doe2023how')).toMatchObject({
      issued: { 'date-parts': [[2023, 5, 14]] },
      accessed: { 'date-parts': [[2024, 1, 10]] },
      publisher: 'The Gradient',
      URL: 'https://thegradient.pub/transformers',
    })
    expect(byId.get('vaswani2017attention')).toMatchObject({
      archive: 'arXiv',
      number: 'arXiv:1706.03762',
      publisher: 'arXiv',
      DOI: '10.48550/arXiv.1706.03762',
      URL: 'https://arxiv.org/abs/1706.03762',
    })
    expect(byId.get('page2022')).toMatchObject({ URL: 'https://example.com/page_one' })
  })

  test('name forms: First von Last, suffixes, braced organisations', () => {
    expect(byId.get('beethoven1800sonatas')!.author).toEqual([
      { family: 'Beethoven', given: 'Ludwig', 'non-dropping-particle': 'van' },
      { family: 'King', given: 'Martin Luther', suffix: 'Jr.' },
    ])
    expect(byId.get('lee2024draft')!.author).toEqual([
      { family: 'Lee', given: 'Kim' },
      { literal: 'Barnes and Noble, Inc.' },
    ])
  })

  test('quoted values, TeX ligatures, month names and literal years', () => {
    const thesis = byId.get('beethoven1800sonatas')!
    expect(thesis.title).toBe('Sonatas — and “quotes” – ranges')
    expect(thesis.genre).toBe("Master's thesis")
    expect(thesis.publisher).toBe('Universität Wien')
    expect(thesis.issued).toEqual({ 'date-parts': [[1800, 12]] })
    const draft = byId.get('lee2024draft')!
    expect(draft.title).toBe('Draft on α-Helices & β-Sheets')
    expect(draft.issued).toEqual({ literal: 'in press' })
    expect(draft.note).toBe('Manuscript in preparation')
  })
})

describe('parseBibTeX: syntax', () => {
  test('@string macros, # concatenation, numbers and parentheses', () => {
    const { items, warnings } = parseBibTeX(`
      @STRING(pre = "Part")
      @string{ end = {the {End}} }
      @Article(key1,
        Title = pre # " " # 2 # {: } # end,
        Year = 2001, Month = sep,
        Journal = "Nested {"}quoted{"} {braces {inside}}"
      )`)
    expect(warnings).toEqual([])
    expect(items[0]).toMatchObject({
      id: 'key1',
      title: 'Part 2: the End',
      'container-title': 'Nested "quoted" braces inside',
      issued: { 'date-parts': [[2001, 9]] },
    })
  })

  test('@comment, @preamble and % comment lines are ignored', () => {
    const { items } = parseBibTeX(String.raw`
      % @article{commented, title = {No}}
      @comment{ @article{inside, title = {No}} }
      @preamble{ "\newcommand{\noopsort}[1]{} " # "\providecommand{\x}{}" }
      @book{real,
        % a comment between fields
        title = {Yes}, year = 2000}
    `)
    expect(items.map((i) => i.id)).toEqual(['real'])
  })

  test('recovers from a broken entry and reports it', () => {
    const { items, warnings } = parseBibTeX(
      '@article{broken, title = {never closed,\n  year = 2020\n@book{fine, title = {Fine}, year = 2001}\n@misc{also, title = "ok"}'
    )
    expect(items.map((i) => i.id)).toEqual(['fine', 'also'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('line 1')
  })

  test('undefined macros, duplicate keys and missing keys produce warnings', () => {
    const { items, warnings } = parseBibTeX(`
      @article{dup, title = {First}, journal = nojournal, year = 2020}
      @article{dup, title = {Second}, year = 2020}
      @book{, title = {Keyless Book}, author = {Doe, Jane}, year = 2019}
    `)
    expect(items.map((i) => i.id)).toEqual(['dup', 'dup-2', 'doe2019keyless'])
    expect(warnings.some((w) => w.includes('undefined macro "nojournal"'))).toBe(true)
    expect(warnings.some((w) => w.includes('Duplicate key "dup"'))).toBe(true)
    expect(warnings.some((w) => w.includes('without a key'))).toBe(true)
  })

  test('dates: biblatex date ranges, numeric months, day fields', () => {
    const { items } = parseBibTeX(`
      @inproceedings{a, title = {A}, date = {2020-03-15/2020-03-20}}
      @article{b, title = {B}, year = {2019}, month = {7}}
      @article{c, title = {C}, year = {2019}, month = {Sept.}, day = {9}}
    `)
    expect(items.map((i) => i.issued)).toEqual([
      {
        'date-parts': [
          [2020, 3, 15],
          [2020, 3, 20],
        ],
      },
      { 'date-parts': [[2019, 7]] },
      { 'date-parts': [[2019, 9, 9]] },
    ])
  })

  test('entry types and Google Scholar arXiv exports', () => {
    const { items } = parseBibTeX(`
      @conference{a, title = {A}}
      @online{b, title = {B}}
      @www{c, title = {C}}
      @electronic{d, title = {D}}
      @misc{e, title = {E}}
      @misc{f, title = {F}, url = {https://f.example}}
      @dataset{g, title = {G}}
      @software{h, title = {H}}
      @inbook{i, title = {I}}
      @article{j, title = {J}, journal = {arXiv preprint arXiv:2301.01234}, year = {2023}}
      @weird{k, title = {K}}
    `)
    expect(items.map((i) => i.type)).toEqual([
      'paper-conference',
      'webpage',
      'webpage',
      'webpage',
      'article',
      'webpage',
      'dataset',
      'software',
      'chapter',
      'article',
      'document',
    ])
    expect(items[9]).toMatchObject({ 'container-title': 'arXiv', number: 'arXiv:2301.01234' })
  })

  test('parses 500 entries well under the time budget', () => {
    const entries = Array.from({ length: 500 }, (_, i) =>
      [
        `@article{key${i},`,
        `  author = {M{\\"u}ller, J{\\"o}rg and Smith, John and {Org ${i}}},`,
        `  title = {Entry {${i}}: on {\\'e}t{\\'e} -- and \\emph{more} at 50\\%},`,
        `  journal = jmlr, year = ${1990 + (i % 30)}, month = jan,`,
        `  volume = {${i}}, number = {${i % 12}}, pages = {${i}--${i + 9}},`,
        `  doi = {10.1000/test.${i}},`,
        `  abstract = {${'Lorem ipsum dolor sit amet. '.repeat(20)}}`,
        '}',
      ].join('\n')
    )
    const text = `@string{jmlr = {Journal of Machine Learning Research}}\n${entries.join('\n\n')}`
    const started = performance.now()
    const { items, warnings } = parseBibTeX(text)
    const elapsed = performance.now() - started
    expect(items).toHaveLength(500)
    expect(warnings).toEqual([])
    expect(items[499]!.title).toBe('Entry 499: on été – and more at 50%')
    expect(elapsed).toBeLessThan(1500)
  })
})

describe('decodeLatex', () => {
  test.each([
    [String.raw`Caf\'e`, 'Café'],
    [String.raw`{\"o}`, 'ö'],
    [String.raw`\"{U}ber`, 'Über'],
    [String.raw`\c{c}a va`, 'ça va'],
    [String.raw`\c c`, 'ç'],
    [String.raw`Stra\ss e`, 'Straße'],
    [String.raw`\o\ and \O`, 'ø and Ø'],
    [String.raw`\aa{}ngstr\"om`, 'ångström'],
    [String.raw`\v{S}koda \v Z`, 'Škoda Ž'],
    [String.raw`Mar\'{\i}a`, 'María'],
    [String.raw`\H{o} \k{a} \={a} \.{z} \u{g} \r{u}`, 'ő ą ā ż ğ ů'],
    [String.raw`\& \% \_ \$ \# \{ \}`, '& % _ $ # { }'],
    ['a~b', 'a b'],
    ['1--2 and a---b', '1–2 and a—b'],
    ['{}{DNA} {T}itle', 'DNA Title'],
    [String.raw`\emph{Hi} \textbf{bold} \textit{it}`, 'Hi bold it'],
    [String.raw`$\alpha$-helix and $x^2$`, 'α-helix and x2'],
    ["``quoted''", '“quoted”'],
    [String.raw`\href{https://x.org}{link text}`, 'link text'],
    ['  spaced\n  out  ', 'spaced out'],
  ])('%s → %s', (input, output) => {
    expect(decodeLatex(input)).toBe(output)
  })
})
