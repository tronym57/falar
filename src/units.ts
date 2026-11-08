// A1 unit list (titles only). Unit content lives in content/a1/*.json.
export const a1Units = [
  { n: 0, title: 'Survival kit', scene: 'Greetings, "I don\'t understand"' },
  { n: 1, title: 'Meeting people', scene: 'Beach car park in Baleal' },
  { n: 2, title: 'Café / pastelaria', scene: 'Ordering at the counter in Peniche' },
  { n: 3, title: 'Numbers & money', scene: 'Paying at the mercado' },
  { n: 4, title: 'Supermarket & mercado', scene: '' },
  { n: 5, title: 'Delivery driver & doorbell', scene: '' },
  { n: 6, title: 'Restaurant', scene: '' },
  { n: 7, title: 'Time & daily routine', scene: '' },
  { n: 8, title: 'Getting around', scene: '' },
  { n: 9, title: 'Surf lineup & beach', scene: '' },
  { n: 10, title: 'Shops & clothes', scene: '' },
  { n: 11, title: 'Free time & plans', scene: '' },
  { n: 12, title: 'Health & pharmacy', scene: '' },
  { n: 13, title: 'A1 checkpoint', scene: '' },
]

export const v1UnitCount = 4

// The fixed step sequence every unit follows. `ready` = the screen for it exists.
export const unitSteps = [
  { slug: 'dialogue', title: 'Dialogue', ready: true },
  { slug: 'phrases', title: 'Key phrases', ready: true },
  { slug: 'vocab', title: 'Vocabulary', ready: true },
  { slug: 'grammar', title: 'Grammar', ready: true },
  { slug: 'exercises', title: 'Exercises', ready: true },
  { slug: 'speaking', title: 'Speaking drill', ready: false },
  { slug: 'check', title: 'Unit check', ready: true },
]
