# Wecker-App

Eine moderne Wecker-Anwendung mit flexiblen Weckzeiten und Wochenprogramm.

## Funktionen

### Kernfunktionen
- **Beliebig viele Weckzeiten pro Tag** - Erstellen Sie so viele Alarme wie benötigt
- **Wochenprogramm** - Individuelle Einstellungen für jeden Wochentag
- **Digitalanzeige** - Große, gut lesbare Uhrzeitanzeige
- **Progressiver Sound** - Weckton wird langsam lauter

### Geplante Features
- [ ] Digitaluhr-Anzeige (Hauptbildschirm)
- [ ] Alarm-Verwaltung (hinzufügen, bearbeiten, löschen)
- [ ] Wochentag-Zuordnung für jeden Alarm
- [ ] Snooze-Funktion
- [ ] Verschiedene Wecktöne zur Auswahl
- [ ] Lautstärke-Rampe (langsam lauter werdend)
- [ ] Alarm-Labels/Beschreibungen
- [ ] Lokale Speicherung der Einstellungen

## Technologie-Stack

- **Frontend**: HTML, CSS, JavaScript
- **Framework**: Tauri (für Desktop-App) oder reine Web-App
- **Styling**: CSS mit modernem Dark-Mode Design
- **Audio**: Web Audio API für Sound-Wiedergabe
- **Speicherung**: LocalStorage oder SQLite (bei Tauri)

## Projektstruktur

```
wecker-app/
├── README.md
├── index.html          # Hauptseite mit Digitaluhr
├── styles.css          # Styling für die App
├── app.js              # Hauptlogik
├── alarm-manager.js    # Alarm-Verwaltung
├── audio-player.js     # Sound-Wiedergabe mit Lautstärke-Rampe
├── storage.js          # Lokale Speicherung
└── assets/
    └── sounds/         # Wecktöne
```

## Installation

```bash
# Repository klonen
cd wecker-app

# Bei Verwendung eines lokalen Servers:
# Live Server in VS Code oder:
npx serve .
```

## Entwicklung

### Nächste Schritte
1. Basis-HTML-Struktur mit Digitaluhr erstellen
2. CSS-Styling für moderne Digitalanzeige
3. JavaScript-Logik für Uhrzeit-Aktualisierung
4. Alarm-Datenstruktur definieren
5. Alarm-Manager implementieren
6. Audio-Player mit Lautstärke-Rampe
7. UI für Alarm-Verwaltung
8. Wochenprogramm-Funktionalität
9. Lokale Speicherung

## Datenstruktur

```javascript
// Beispiel Alarm-Objekt
{
  id: "uuid",
  time: "07:30",
  label: "Aufstehen",
  enabled: true,
  days: ["mo", "di", "mi", "do", "fr"], // Wochentage
  sound: "alarm1.mp3",
  volume: {
    start: 0.1,    // Startlautstärke (10%)
    end: 1.0,      // Endlautstärke (100%)
    duration: 30   // Sekunden bis volle Lautstärke
  },
  snooze: {
    enabled: true,
    duration: 5    // Minuten
  }
}
```

## Lizenz

MIT License
