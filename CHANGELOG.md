# Changelog

## [1.0.0] - 2026-02-28

### Initial Release

- **Python bridge service** (`bridge/kwin-dbus-bridge.py`) that registers `org.kde.kwin.Scripted` on the D-Bus session bus, caches all state, serves queries, and re-emits signals to external consumers.
- **Modular KWin scripts** — enable only the features you need:
  - `kwin-dbus-active-window` — tracks active window changes
  - `kwin-dbus-windows` — maintains full window list with add/remove lifecycle events
  - `kwin-dbus-window-properties` — tracks 25+ property changes per window
  - `kwin-dbus-desktop` — tracks virtual desktop and activity changes
  - `kwin-dbus-geometry` — tracks window geometry changes (move/resize)
  - `kwin-dbus-cursor` — tracks cursor position (throttled)
- **`install.sh`** — installs the bridge as a systemd user service, copies KWin scripts, enables them in KWin config, and starts everything.
- **`uninstall.sh`** — cleanly removes all installed components.
- **D-Bus API** exposed on `org.kde.kwin.Scripted`:
  - `/ActiveWindow` — `Get()` method and `Changed(json)` signal
  - `/Windows` — `GetAll()`, `GetById()`, `QueryByName()`, `QueryByClass()`, `QueryByPid()` methods; `Added(json)` and `Removed(id)` signals
  - `/Properties` — `Get(id)` method and `Changed(id, property, value)` signal
  - `/Desktop` — `GetCurrent()`, `GetAll()`, `GetCurrentActivity()` methods; `Changed(json)` and `ActivityChanged(id)` signals
  - `/Geometry` — `Get(id)` method and `Changed(id, json)` signal
  - `/Cursor` — `GetPosition()` method and `Moved(x, y)` signal
  - `/Bridge` — internal push interface used by KWin scripts
- Requires KDE Plasma 6 (KWin 6.x), Python 3 with `dbus-python` and `PyGObject`, and `systemd`.
