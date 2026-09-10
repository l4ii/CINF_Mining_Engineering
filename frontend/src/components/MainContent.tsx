import { lazy, Suspense } from 'react'
import ProjectFlow from './mining/ProjectFlow'
import type { MiningMethodId } from '../mining/types'
const AboutPage = lazy(() => import('./shell/AboutPage'))
const SettingsPage = lazy(() => import('./shell/SettingsPage'))

export interface MainContentProps {
  selectedMethod?: MiningMethodId | null
  darkMode?: boolean
  currentView?: 'module' | 'about' | 'settings'
  aboutDepartment?: string | null
  aboutVisit?: number
  language?: 'zh' | 'en'
  darkModeValue?: boolean
  onDarkModeChange?: (dark: boolean) => void
  onLanguageChange?: (lang: 'zh' | 'en') => void
  onBackToHome?: () => void
  onMethodSelect?: (method: MiningMethodId) => void
}

export default function MainContent({
  darkMode = false,
  currentView = 'module',
  aboutDepartment = null,
  aboutVisit = 0,
  language = 'zh',
  darkModeValue = false,
  onDarkModeChange,
  onLanguageChange,
  onBackToHome,
}: MainContentProps) {
  if (currentView === 'about' && aboutDepartment) {
    return <Suspense fallback={null}><AboutPage darkMode={darkMode} language={language} aboutDepartment={aboutDepartment} aboutVisit={aboutVisit} onBackToHome={onBackToHome} /></Suspense>
  }
  if (currentView === 'settings') {
    return <Suspense fallback={null}><SettingsPage darkMode={darkMode} language={language} darkModeValue={darkModeValue} onDarkModeChange={onDarkModeChange} onLanguageChange={onLanguageChange} onBackToHome={onBackToHome} /></Suspense>
  }
  return (
    <ProjectFlow
      darkMode={darkMode}
      language={language}
    />
  )
}
