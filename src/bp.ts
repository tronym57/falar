// Brazilian Portuguese markers: words and forms that are Brazilian where Portugal says something else.
// Used by the content linter (scripts/content.mjs) and by the app for AI-generated text.
// Words/forms that are Brazilian (or Brazilian spelling) where Portugal uses something else.
const BP_WORDS: Record<string, string> = {
  'ônibus': 'autocarro', onibus: 'autocarro', celular: 'telemóvel', trem: 'comboio',
  banheiro: 'casa de banho', 'café da manhã': 'pequeno-almoço', geladeira: 'frigorífico',
  sorvete: 'gelado', suco: 'sumo', 'xícara': 'chávena', 'aeromoça': 'hospedeira',
  'metrô': 'metro', 'pedágio': 'portagem', 'esporte': 'desporto', 'registro': 'registo',
  'econômico': 'económico', 'gênero': 'género', 'tênis': 'ténis', 'bebê': 'bebé',
  'antônio': 'António', 'fenômeno': 'fenómeno', 'acadêmico': 'académico',
  'oi': 'olá', 'a gente': 'nós (a gente is informal/Brazilian-leaning)', 'moça': 'rapariga / menina',
  garoto: 'miúdo / rapaz',  legal: 'fixe (if meaning "cool")',
  entendi: 'percebi',
  'cardápio': 'ementa', 'garçom': 'empregado', 'açougue': 'talho', 'sanduíche': 'sandes / tosta',
  cafezinho: 'café / bica',
}
const GERUND_AFTER_ESTAR = /\b(estou|estás|está|estamos|estão|estava|estavam)\s+\p{L}+ndo\b/iu
// A clitic pronoun at the very start of a sentence: "Me chamo" (Portugal: "Chamo-me").
const SENTENCE_INITIAL_CLITIC = /(^|[.!?…]\s+|["“]\s*)(me|te|se|nos|lhe|lhes)\s+\p{L}+/iu

/** Brazilian-Portuguese problems in a text, as readable messages (empty = looks European). */
export function bpProblems(text: string): string[] {
  const problems: string[] = []
  const lower = text.toLowerCase()
  for (const [word, pt] of Object.entries(BP_WORDS)) {
    const re = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu')
    if (re.test(lower)) problems.push(`Brazilian "${word}" → use ${pt}`)
  }
  // "Pois não?" alone = Brazilian "How can I help?". As a tag after a comma ("…, pois não?") it's normal in Portugal.
  if (/(^|[^\p{L}])pois não([^\p{L}]|$)/iu.test(text) && !/,\s*pois não\s*\?/iu.test(text)) problems.push('Brazilian "pois não" (= how can I help?). As a tag ("…, pois não?") it\'s fine')
  if (GERUND_AFTER_ESTAR.test(text)) problems.push('estar + gerund (-ndo) → use "estar a + infinitive"')
  // "Se faz favor" (= please): here se means "if", not a pronoun.
  if (SENTENCE_INITIAL_CLITIC.test(text.replace(/\bse faz favor/giu, ''))) problems.push('pronoun before the verb at sentence start → "Chamo-me", not "Me chamo"')
  return problems
}
