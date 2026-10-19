// Wendet das gemerkte Farbschema an, bevor die Seite gezeichnet wird (siehe src/lib/theme.ts).
try {
  var theme = localStorage.getItem('essenplaner.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // Ohne Speicher gilt die Systemeinstellung.
}
