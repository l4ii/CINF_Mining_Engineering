import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { ASSISTANT_DISMISSED_KEY } from '../context/AssistantContext'
import { PROJECT_STORE_KEY } from '../mining/project'

afterEach(() => {
  sessionStorage.removeItem(ASSISTANT_DISMISSED_KEY)
  localStorage.removeItem(PROJECT_STORE_KEY)
})

