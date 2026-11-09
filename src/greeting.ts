// Home greeting: by time of day (as said in Portugal), with your name, plus a short phrase that changes daily.

/** Bom dia until lunch, boa tarde until evening, boa noite after dark. */
export function timeGreeting(now = new Date()) {
  const h = now.getHours()
  return h >= 5 && h < 13 ? 'Bom dia' : h >= 13 && h < 20 ? 'Boa tarde' : 'Boa noite'
}

export const PHRASES = [
  { pt: 'Vamos a isso!', en: "Let's do it!" },
  { pt: 'Tudo bem?', en: 'All good?' },
  { pt: 'Pronto para praticar?', en: 'Ready to practise?' },
  { pt: 'Um bocadinho todos os dias.', en: 'A little bit every day.' },
  { pt: 'Devagar se vai ao longe.', en: 'Slowly you get far.' },
  { pt: 'Bem-vindo de volta!', en: 'Welcome back!' },
  { pt: 'Hoje é um bom dia para aprender.', en: "Today's a good day to learn." },
]

/** The same phrase all day, a different one tomorrow. */
export function dailyPhrase(now = new Date()) {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
  return PHRASES[day % PHRASES.length]
}

export function greeting(name: string, now = new Date()) {
  const first = name.trim().split(/\s+/)[0]
  return `${timeGreeting(now)}${first ? `, ${first}` : ''}!`
}
