import { describe, expect, it } from 'vitest'
import { parseIngredients } from './ingredient'
import { findStepIngredients } from './stepIngredients'
import { resolveStepAmounts } from './stepAmounts'

function names(step: string, lines: string[]): string[] {
  const ingredients = parseIngredients(lines)
  return findStepIngredients(step, ingredients).map((index) => ingredients[index].text)
}

const curry = ['600 g Hähnchenbrust', '1 Zwiebel', '2 Knoblauchzehen', '1 EL Currypulver', '400 ml Kokosmilch', '1 rote Paprika', 'Salz und Pfeffer', '250 g Basmatireis']
const chickpeas = ['2 Dosen Kichererbsen', '200 g Blattspinat', '1 Dose gehackte Tomaten', '200 ml Kokosmilch', '1 EL rote Currypaste']
const lentils = ['250 g Tellerlinsen', '2 Karotten', '1 Stange Lauch', '3 Kartoffeln', '1,5 l Gemüsebrühe', '2 EL Essig']

describe('findStepIngredients', () => {
  it.each([
    ['Reis nach Packungsanweisung kochen.', ['250 g Basmatireis']],
    ['Hähnchen in Würfel schneiden, Zwiebel und Knoblauch fein hacken.', ['600 g Hähnchenbrust', '1 Zwiebel', '2 Knoblauchzehen']],
    ['Hähnchen in Öl rundherum anbraten, Zwiebel und Knoblauch zugeben.', ['600 g Hähnchenbrust', '1 Zwiebel', '2 Knoblauchzehen']],
    ['Currypulver kurz mitrösten, mit Kokosmilch ablöschen.', ['1 EL Currypulver', '400 ml Kokosmilch']],
    ['Paprika in Streifen zugeben und 10 Minuten köcheln lassen, abschmecken.', ['1 rote Paprika']],
  ])('ordnet im Hähnchen-Curry „%s“ zu', (step, expected) => {
    expect(names(step, curry)).toEqual(expected)
  })

  it.each([
    ['Currypaste in etwas Öl anrösten.', ['1 EL rote Currypaste']],
    ['Tomaten, Kokosmilch und abgetropfte Kichererbsen zugeben und 15 Minuten köcheln.', ['2 Dosen Kichererbsen', '1 Dose gehackte Tomaten', '200 ml Kokosmilch']],
    ['Spinat unterheben, bis er zusammenfällt.', ['200 g Blattspinat']],
  ])('ordnet im Kichererbsen-Curry „%s“ zu', (step, expected) => {
    expect(names(step, chickpeas)).toEqual(expected)
  })

  it.each([
    ['Die Tomate würfeln.', ['3 Tomaten'], ['3 Tomaten']],
    ['Die Äpfel schälen.', ['1 Apfel'], ['1 Apfel']],
    ['Mit 2 Eiern verrühren.', ['3 Eier'], ['3 Eier']],
    ['Mit Salz würzen.', ['Salz und Pfeffer'], ['Salz und Pfeffer']],
    ['Die Milch erwärmen.', ['200 ml Milch', '400 ml Kokosmilch'], ['200 ml Milch']],
    ['Mit Brühe ablöschen.', lentils, ['1,5 l Gemüsebrühe']],
    ['Linsen und Karotten 20 Minuten garen.', lentils, ['250 g Tellerlinsen', '2 Karotten']],
    ['Frühlingszwiebeln in Ringe schneiden.', ['1 Bund Frühlingszwiebeln'], ['1 Bund Frühlingszwiebeln']],
    ['Tomaten (aus der Dose) zugeben.', ['1 Dose Tomaten (stückig)'], ['1 Dose Tomaten (stückig)']],
  ])('erkennt „%s“', (step, lines, expected) => {
    expect(names(step, lines)).toEqual(expected)
  })

  it.each([
    ['Abschmecken und servieren.', curry],
    ['Das Gemüse putzen und klein schneiden.', lentils],
    ['Nudeln kochen.', ['200 g Kochschinken']],
    ['Alles in einen Topf geben.', lentils],
    ['Den Ofen auf 200 °C vorheizen.', ['1 Ofenkartoffel']],
  ])('ordnet „%s“ nichts zu', (step, lines) => {
    expect(names(step, lines)).toEqual([])
  })

  it('erkennt HelloFresh-Schritte mit Mengen-Varianten nach dem Auflösen', () => {
    const step = 'Brotwürfel, 200 ml [300 ml | 400 ml] Milch*, 0,5 TL [0,75 TL | 1 TL] Salz* und Pfeffer* mischen.'
    const resolved = resolveStepAmounts(step).map((part) => part.text).join('')
    expect(names(resolved, ['150 g Brot', '300 ml Milch', 'Salz', 'Pfeffer', '1 Ei'])).toEqual(['150 g Brot', '300 ml Milch', 'Salz', 'Pfeffer'])
  })

  it.each([
    ['Die Hälfte der Zwiebel 4 – 5 Min. anbraten. Mit 2 EL Wasser* ablöschen.', ['1 Zwiebel', 'Wasser'], ['1 Zwiebel', 'Wasser']],
    ['Die Hälfte Preiselbeerenmarmelade, 1 EL Balsamicoessig* und 1 EL Öl* verrühren.', ['50 g Preiselbeerenmarmelade', '2 EL Balsamicoessig', '2 EL Öl'], ['50 g Preiselbeerenmarmelade', '2 EL Balsamicoessig', '2 EL Öl']],
    ['In einer zweiten großen Pfanne ca. 100 ml Öl* erwärmen.', ['2 EL Öl', '1 Packung Knödelteig'], ['2 EL Öl']],
    ['Aus dem Knödelteig ca. 6 flache Knödel formen.', ['1 Packung Knödelteig', '2 EL Öl'], ['1 Packung Knödelteig']],
    ['Mit 2 großen Eiern verrühren.', ['2 große Eier', '100 g Mehl'], ['2 große Eier']],
  ])('erkennt den HelloFresh-Schritt „%s“', (step, lines, expected) => {
    expect(names(step, lines)).toEqual(expected)
  })
})
