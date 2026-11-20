import { createContext, useContext, type ReactNode } from 'react'

export interface RunbookProcessContextValue {
  runbookId: number
  projectId: number
  processId: number
  runbookName: string
}

const RunbookProcessContext = createContext<RunbookProcessContextValue | null>(null)

export function RunbookProcessContextProvider({
  value,
  children,
}: {
  value: RunbookProcessContextValue | null | undefined
  children: ReactNode
}) {
  return (
    <RunbookProcessContext.Provider value={value ?? null}>
      {children}
    </RunbookProcessContext.Provider>
  )
}

export function useRunbookProcessContext() {
  return useContext(RunbookProcessContext)
}
