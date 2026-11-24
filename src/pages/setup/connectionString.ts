export type SslMode = 'Disable' | 'Prefer' | 'Require'
export type ConnectionStringKind = 'postgres' | 'redis'

export interface PostgresFields {
  host?: string
  port?: number | string
  database?: string
  username?: string
  password?: string
  sslMode?: SslMode
}

const MASK = '******'
const PASSWORD_KEYS = new Set(['password', 'pwd', 'psw'])
const SEPARATORS: Record<ConnectionStringKind, string> = { postgres: ';', redis: ',' }

// Npgsql (DbConnectionStringBuilder) syntax: a value holding a separator, quote or edge whitespace
// must be double-quoted, with embedded double quotes doubled.
function quoteValue(value: string) {
  if (!/[;="']|^\s|\s$/.test(value)) return value

  return `"${value.replace(/"/g, '""')}"`
}

/** Composes an Npgsql connection string from the "fill by fields" helper; empty fields are omitted. */
export function composeNpgsqlConnectionString(fields: PostgresFields): string {
  const pairs: Array<[string, string]> = [
    ['Host', String(fields.host ?? '').trim()],
    ['Port', String(fields.port ?? '').trim()],
    ['Database', String(fields.database ?? '').trim()],
    ['Username', String(fields.username ?? '').trim()],
    ['Password', fields.password ?? ''],
    ['SSL Mode', fields.sslMode ?? ''],
  ]

  return pairs
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${quoteValue(value)}`)
    .join(';')
}

/** End index (exclusive) of a value starting at `start`: a quoted value ends at its closing quote (doubled quotes are escapes), otherwise at the separator. */
function valueEnd(text: string, start: number, separator: string) {
  let i = start
  while (i < text.length && text[i] === ' ') i++

  const quote = text[i]
  if (separator === ';' && (quote === '"' || quote === "'")) {
    for (i += 1; i < text.length; i++) {
      if (text[i] !== quote) continue
      if (text[i + 1] === quote) i++
      else return i + 1
    }
    return text.length
  }

  const next = text.indexOf(separator, start)
  return next === -1 ? text.length : next
}

interface Segment {
  key: string
  valueStart: number
  valueEnd: number
}

/** Splits `key=value` pairs; a segment without `=` (e.g. a Redis `host:port`) is not a pair. */
function keyValueSegments(text: string, separator: string): Segment[] {
  const segments: Segment[] = []
  let i = 0

  while (i < text.length) {
    const eq = text.indexOf('=', i)
    const sep = text.indexOf(separator, i)
    if (eq === -1) break
    if (sep !== -1 && sep < eq) {
      i = sep + 1
      continue
    }

    const end = valueEnd(text, eq + 1, separator)
    segments.push({ key: text.slice(i, eq).trim(), valueStart: eq + 1, valueEnd: end })
    i = end + 1
  }

  return segments
}

function unquote(raw: string) {
  const value = raw.trim()
  const quote = value[0]
  if ((quote !== '"' && quote !== "'") || value.length < 2 || value[value.length - 1] !== quote) return value

  return value.slice(1, -1).split(quote + quote).join(quote)
}

/** Parses an Npgsql connection string into its keys and (unquoted) values. */
export function parseNpgsqlConnectionString(text: string): Record<string, string> {
  return Object.fromEntries(keyValueSegments(text, ';').map((segment) => [segment.key, unquote(text.slice(segment.valueStart, segment.valueEnd))]))
}

function maskKeyValuePasswords(text: string, separator: string) {
  let result = ''
  let cursor = 0

  for (const segment of keyValueSegments(text, separator)) {
    if (!PASSWORD_KEYS.has(segment.key.toLowerCase())) continue
    result += text.slice(cursor, segment.valueStart) + MASK
    cursor = segment.valueEnd
  }

  return result + text.slice(cursor)
}

/** `scheme://user:secret@host` and `scheme://:secret@host` → secret masked. */
function maskUrlPasswords(text: string) {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/[^:/@\s]*:)[^@\s]*@/gi, `$1${MASK}@`)
}

/** Hides passwords (password / pwd / psw) in Npgsql or StackExchange.Redis strings and in URL-style credentials. */
export function maskConnectionString(value: string, kind: ConnectionStringKind): string {
  return maskUrlPasswords(maskKeyValuePasswords(value, SEPARATORS[kind]))
}
