import { createContext, useContext, useState } from 'react'
import fr from './fr.json'
import en from './en.json'
import frameworkFr from './framework_fr.json'

const TRANSLATIONS = { fr, en }
const Ctx = createContext({ lang: 'fr', setLang: () => {}, t: k => k, tf: () => null })

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'fr')
  const changeLang = l => { setLang(l); localStorage.setItem('lang', l) }
  const t = key => {
    const parts = key.split('.')
    let v = TRANSLATIONS[lang]
    for (const p of parts) v = v?.[p]
    return v || key
  }
  const tf = (type, code) => lang === 'en' ? null : (frameworkFr[type]?.[code] || null)
  return <Ctx.Provider value={{ lang, setLang: changeLang, t, tf }}>{children}</Ctx.Provider>
}
export const useT = () => useContext(Ctx)
