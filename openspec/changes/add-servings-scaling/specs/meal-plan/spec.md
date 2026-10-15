## MODIFIED Requirements

### Requirement: Geplantes Rezept öffnen
Das System SHALL für jeden Rezepteintrag und jeden Reste-Eintrag einen direkten Weg zur Detailansicht des Rezepts anbieten. Weichen die Portionen des Eintrags von denen des Rezepts ab, MUST die Detailansicht mit diesen Portionen geöffnet werden. Ein Reste-Eintrag MUST dafür die Portionen seines Originaleintrags verwenden, sofern dieser in der angezeigten Woche liegt.

#### Scenario: Vom Plan zum Rezept
- **WHEN** der Nutzer auf einen Rezepteintrag tippt
- **THEN** öffnet das System die Detailansicht dieses Rezepts

#### Scenario: Abweichende Portionen
- **WHEN** der Nutzer auf den Eintrag „Linsensuppe · 8 Portionen“ (Rezept: 6) tippt
- **THEN** öffnet das System die Detailansicht mit 8 gewählten Portionen

#### Scenario: Reste
- **WHEN** der Nutzer auf „Reste: Linsensuppe“ tippt und der Originaleintrag derselben Woche 8 Portionen hat
- **THEN** öffnet das System die Detailansicht mit 8 gewählten Portionen
