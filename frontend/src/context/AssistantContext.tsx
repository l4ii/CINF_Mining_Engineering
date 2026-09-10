import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const ASSISTANT_DISMISSED_KEY = 'cinf-assistant-dismissed'

function readAssistantDismissed(): boolean {
  try {
    return sessionStorage.getItem(ASSISTANT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

type AssistantContextValue = {
  assistantDockOpen: boolean
  setAssistantDockOpen: (open: boolean) => void
  assistantDismissed: boolean
  dismissAssistant: () => void
  pendingAssistantPrompt: string | null
  askAssistant: (prompt: string) => void
  clearPendingAssistantPrompt: () => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [assistantDockOpen, setAssistantDockOpen] = useState(false)
  const [assistantDismissed, setAssistantDismissed] = useState(readAssistantDismissed)
  const [pendingAssistantPrompt, setPendingAssistantPrompt] = useState<string | null>(null)

  const dismissAssistant = useCallback(() => {
    setAssistantDismissed(true)
    setAssistantDockOpen(false)
    try {
      sessionStorage.setItem(ASSISTANT_DISMISSED_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const askAssistant = useCallback((prompt: string) => {
    const text = prompt.trim()
    if (!text || readAssistantDismissed()) return
    setPendingAssistantPrompt(text)
    setAssistantDockOpen(true)
  }, [])

  const clearPendingAssistantPrompt = useCallback(() => {
    setPendingAssistantPrompt(null)
  }, [])

  const value = useMemo(
    () => ({
      assistantDockOpen,
      setAssistantDockOpen,
      assistantDismissed,
      dismissAssistant,
      pendingAssistantPrompt,
      askAssistant,
      clearPendingAssistantPrompt,
    }),
    [
      askAssistant,
      assistantDismissed,
      assistantDockOpen,
      clearPendingAssistantPrompt,
      dismissAssistant,
      pendingAssistantPrompt,
    ]
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistantContext(): AssistantContextValue {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistantContext must be used within AssistantProvider')
  return ctx
}
