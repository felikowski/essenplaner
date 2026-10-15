import type { Ingredient } from '../types'
import { scaleAmount } from './scale'

export interface SubstitutionMatch {
  name: string
  suggestions: string[]
}

interface SubstitutionDefinition {
  names: string[]
  suggestions: string[]
}

/** Gängige Küchenalternativen; Formulierungen und Verhältnisse sind bewusst knapp gehalten. */
export const SUBSTITUTIONS: SubstitutionDefinition[] = [
  { names: ['buttermilch'], suggestions: ['Gleiche Menge Milch mit Zitronensaft säuern und 10 Minuten stehen lassen.'] },
  { names: ['crème fraîche', 'creme fraiche'], suggestions: ['1:1 Schmand oder saure Sahne verwenden.'] },
  { names: ['schmand'], suggestions: ['1:1 Crème fraîche oder saure Sahne verwenden.'] },
  { names: ['saure sahne', 'sauerrahm'], suggestions: ['1:1 Schmand verwenden oder Naturjoghurt mit etwas Sahne mischen.'] },
  { names: ['sahne', 'schlagsahne'], suggestions: ['1:1 Kochsahne oder Milch mit etwas Butter verwenden.'] },
  { names: ['milch'], suggestions: ['1:1 ungesüßten Pflanzendrink verwenden.'] },
  { names: ['joghurt', 'naturjoghurt'], suggestions: ['1:1 Skyr, Quark oder saure Sahne verwenden.'] },
  { names: ['quark', 'speisequark'], suggestions: ['1:1 Frischkäse mit etwas Milch glatt rühren.'] },
  { names: ['frischkäse'], suggestions: ['1:1 Quark oder abgetropften Joghurt verwenden.'] },
  { names: ['mascarpone'], suggestions: ['1:1 Frischkäse mit etwas Sahne verwenden.'] },
  { names: ['butter'], suggestions: ['Zum Braten 1:1 Margarine oder etwa 80 % der Menge Öl verwenden.'] },
  { names: ['margarine'], suggestions: ['1:1 Butter verwenden.'] },
  { names: ['ei', 'eier'], suggestions: ['Beim Backen ersetzt 1 EL geschrotete Leinsamen mit 3 EL Wasser ein Ei.'] },
  { names: ['mehl', 'weizenmehl'], suggestions: ['1:1 Dinkelmehl verwenden; der Flüssigkeitsbedarf kann leicht abweichen.'] },
  { names: ['speisestärke', 'maisstärke'], suggestions: ['1:1 Kartoffelstärke verwenden oder die doppelte Menge Mehl.'] },
  { names: ['backpulver'], suggestions: ['1 TL Backpulver durch ½ TL Natron plus 1 TL Zitronensaft ersetzen.'] },
  { names: ['natron'], suggestions: ['1 TL Natron durch 3 TL Backpulver ersetzen.'] },
  { names: ['zucker'], suggestions: ['1:1 Rohrohrzucker verwenden; flüssige Süße verändert die Teigkonsistenz.'] },
  { names: ['puderzucker'], suggestions: ['Fein gemahlenen Haushaltszucker 1:1 verwenden.'] },
  { names: ['honig'], suggestions: ['1:1 Ahornsirup oder Agavendicksaft verwenden.'] },
  { names: ['ahornsirup'], suggestions: ['1:1 Honig oder Agavendicksaft verwenden.'] },
  { names: ['zitronensaft'], suggestions: ['1:1 Limettensaft oder milden hellen Essig verwenden.'] },
  { names: ['limettensaft'], suggestions: ['1:1 Zitronensaft verwenden.'] },
  { names: ['weißwein', 'weisswein'], suggestions: ['1:1 Brühe mit einem Spritzer Zitronensaft verwenden.'] },
  { names: ['rotwein'], suggestions: ['1:1 Traubensaft mit einem Spritzer Essig oder Brühe verwenden.'] },
  { names: ['reisessig'], suggestions: ['1:1 milden Apfelessig verwenden.'] },
  { names: ['sojasauce', 'sojasoße'], suggestions: ['1:1 Tamari verwenden; bei Brühe zusätzlich salzen.'] },
  { names: ['fischsauce', 'fischsoße'], suggestions: ['Mit Sojasauce und wenig Limettensaft abschmecken.'] },
  { names: ['gemüsebrühe', 'gemuesebruehe'], suggestions: ['Wasser mit Salz, Pfeffer und getrockneten Kräutern abschmecken.'] },
  { names: ['kokosmilch'], suggestions: ['1:1 Sahne oder ungesüßten Pflanzendrink mit etwas Nussmus verwenden.'] },
  { names: ['tahini', 'sesammus'], suggestions: ['1:1 ungesüßtes Erdnuss- oder Mandelmus verwenden.'] },
  { names: ['erdnussbutter', 'erdnussmus'], suggestions: ['1:1 Mandelmus oder Tahini verwenden.'] },
  { names: ['parmesan'], suggestions: ['1:1 Pecorino verwenden; als pflanzliche Alternative Hefeflocken nehmen.'] },
  { names: ['feta', 'schafskäse'], suggestions: ['1:1 Hirtenkäse oder festen Ziegenkäse verwenden.'] },
  { names: ['mozzarella'], suggestions: ['1:1 milden jungen Gouda verwenden.'] },
  { names: ['koriander'], suggestions: ['Petersilie verwenden; das Aroma ist milder und anders.'] },
  { names: ['petersilie'], suggestions: ['Kerbel oder das Grün von Sellerie verwenden.'] },
  { names: ['basilikum'], suggestions: ['Petersilie mit etwas Minze oder getrocknetes Basilikum verwenden.'] },
  { names: ['thymian'], suggestions: ['Oregano oder Majoran verwenden.'] },
  { names: ['rosmarin'], suggestions: ['Thymian verwenden und etwas sparsamer dosieren.'] },
]

/** Sucht unabhängig von Großschreibung über Hauptnamen und gebräuchliche Varianten. */
export function substitutionsFor(ingredient: Ingredient, factor = 1): SubstitutionMatch | null {
  const key = normalize(ingredient.name)
  const definition = SUBSTITUTIONS.find(({ names }) => names.some((name) => normalize(name) === key))
  if (!definition) return null
  const suggestions = definition.names[0] === 'buttermilch' ? buttermilkSuggestion(ingredient, factor) : definition.suggestions
  return { name: ingredient.name, suggestions }
}

function buttermilkSuggestion(ingredient: Ingredient, factor: number): string[] {
  if (ingredient.quantity === undefined || ingredient.unit !== 'ml') return ['Milch mit Zitronensaft säuern und 10 Minuten stehen lassen.']
  const milk = scaleAmount({ quantity: ingredient.quantity, unit: 'ml' }, factor)
  const acid = scaleAmount({ quantity: ingredient.quantity / 200, unit: 'EL' }, factor)
  return [`${milk.quantity} ${milk.unit} Milch + ${acid.quantity} ${acid.unit} Zitronensaft, 10 Minuten stehen lassen`]
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ')
}
