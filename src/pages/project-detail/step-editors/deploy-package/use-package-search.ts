import { useCallback, useEffect, useRef, useState } from 'react'
import { searchExternalFeedPackages } from 'pages/apis/externalFeed'

export function usePackageSearch(feedId: number | null) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const searchSeq = useRef(0)

  const clear = useCallback(() => {
    searchSeq.current += 1
    setQuery('')
    setOptions([])
    setLoading(false)
  }, [])

  const invalidate = useCallback(() => {
    searchSeq.current += 1
    setOptions([])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!feedId) {
      invalidate()
      return
    }
    const trimmed = query.trim()
    if (!trimmed) {
      invalidate()
      return
    }

    const seq = ++searchSeq.current
    const timer = window.setTimeout(() => {
      setLoading(true)
      searchExternalFeedPackages({ feedId, query: trimmed, take: 20 })
        .then((res) => {
          if (seq !== searchSeq.current) return
          const names = (res.packages ?? []).filter((p): p is string => typeof p === 'string' && p.length > 0)
          setOptions(Array.from(new Set(names)))
        })
        .catch(() => {
          if (seq === searchSeq.current) setOptions([])
        })
        .finally(() => {
          if (seq === searchSeq.current) setLoading(false)
        })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [feedId, query, invalidate])

  return {
    query,
    setQuery,
    options,
    loading,
    clear,
    invalidate,
  }
}
