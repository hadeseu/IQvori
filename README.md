# IQvori

Lern-App von Fabian Emmer. © 2026 Fabian Emmer

## Download

**https://github.com/hadeseu/IQvori/releases/latest/download/IQvori-Setup.exe**

Link anklicken, Datei öffnen, installieren. Fertig.

## Einmalig einrichten (nur Fabian, alles im Browser)

1. Auf github.com einloggen, oben rechts **+** → **New repository**.
   Name: `IQvori`, **Public** auswählen, **Create repository**.
2. Auf der neuen Seite **uploading an existing file** anklicken.
3. Den **Inhalt** des Ordners IQvori (alle Dateien und Ordner, auch `.github`) ins Fenster ziehen
   → unten **Commit changes**.
4. Etwa 10 Minuten warten. Unter **Actions** sieht man den Fortschritt.
5. Danach funktioniert der Download-Link oben.

Falls der Ordner `.github` beim Hochladen fehlt: **Add file** → **Create new file**,
als Namen `.github/workflows/release.yml` eintippen und den Inhalt der Datei aus der ZIP hineinkopieren.

## Update veröffentlichen

1. Auf GitHub die Datei `package.json` öffnen → Stift-Symbol.
2. `"version": "1.0.0"` auf die nächste Nummer ändern, zum Beispiel `"1.0.1"`.
3. **Commit changes**.

Nach etwa 10 Minuten ist das Update online. Alle installierten IQvori-Apps laden es
beim nächsten Start automatisch und zeigen oben „Jetzt neu starten“.
Geänderte Dateien lädst du genauso über **Add file** → **Upload files** hoch.

## KI-Zugang

Beim ersten Start fragt IQvori nach einem Anthropic-API-Schlüssel
(https://console.anthropic.com/settings/keys). Er wird verschlüsselt nur auf dem Gerät gespeichert.
