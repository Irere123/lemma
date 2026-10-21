// Citations for the Research writing mode: import reference libraries,
// resolve identifiers, format citations and bibliographies, export BibTeX.
// Zero-dependency and DOM-free (Workers, browsers, Bun).

export { parseBibTeX } from './bibtex'
export { escapeBibTeX, toBibTeX, toBibTeXKey } from './bibtex-export'
export { makeCiteKey } from './citekey'
export {
  CSL_TYPES,
  type CslDate,
  type CslItem,
  type CslName,
  type CslType,
  normalizeItem,
  type ParseResult,
} from './csl'
export {
  type BibliographyEntry,
  type CitationCluster,
  type CitationItemRef,
  type CitationProcessor,
  createCitationProcessor,
  type Formatted,
  type LocatorLabel,
  type ProcessResult,
  STYLES,
  type StyleId,
} from './format'
export {
  arxivBaseId,
  cleanDoi,
  detectIdentifier,
  type Identifier,
  type IdentifierKind,
  normalizeArxivId,
  normalizeIsbn,
} from './identifiers'
export { decodeLatex } from './latex'
export { type LibraryFormat, parseCslJson, parseLibrary } from './parse'
export {
  ResolveError,
  type ResolveErrorKind,
  type ResolveOptions,
  resolveIdentifier,
} from './resolve'
export { parseRIS } from './ris'
