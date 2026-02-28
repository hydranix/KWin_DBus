# KWin D-Bus Bridge

Expose KWin's window management API onto D-Bus through a collection of modular KWin scripts and a Python bridge service.

## Architecture

```
┌─────────────────────┐     callDBus()      ┌──────────────────────┐     D-Bus      ┌──────────────────┐
│   KWin Scripts      │ ──────────────────▶  │  Python Bridge       │ ◀────────────▶ │ External Apps    │
│                     │                      │  (org.kde.kwin.      │                │ (qdbus, scripts, │
│  • active-window    │  Push events &       │   Scripted)          │  Query/Signal  │  your programs)  │
│  • windows          │  state updates       │                      │                │                  │
│  • window-props     │                      │  Caches all state,   │                │                  │
│  • desktop          │                      │  serves queries,     │                │                  │
│  • geometry         │                      │  re-emits signals    │                │                  │
│  • cursor           │                      │                      │                │                  │
└─────────────────────┘                      └──────────────────────┘                └──────────────────┘
```

KWin scripts **cannot** register their own D-Bus services. This project works around that limitation by having scripts push data to an external Python bridge service via `callDBus()`. The bridge registers `org.kde.kwin.Scripted` on the session bus and exposes a clean API.

## Scripts (Modular — Enable Only What You Need)

| Script | What It Does |
|--------|-------------|
| `kwin-dbus-active-window` | Tracks active window changes, pushes full window info |
| `kwin-dbus-windows` | Maintains full window list, tracks add/remove lifecycle |
| `kwin-dbus-window-properties` | Tracks 25+ property changes per window (caption, minimized, fullscreen, etc.) |
| `kwin-dbus-desktop` | Tracks virtual desktop and activity changes |
| `kwin-dbus-geometry` | Tracks window geometry changes (move/resize) |
| `kwin-dbus-cursor` | Tracks cursor position (throttled) |

## Installation

### Prerequisites

- KDE Plasma 6 (KWin 6.x)
- Python 3 with `dbus-python` and `PyGObject`
- `systemd` (user services)

```bash
# On most KDE systems, these are already installed:
pip install dbus-python PyGObject
# Or via system package manager:
# sudo apt install python3-dbus python3-gi     # Debian/Ubuntu
# sudo pacman -S python-dbus python-gobject    # Arch
# nix-shell -p python3Packages.dbus-python python3Packages.pygobject3  # NixOS
```

### Install Everything

```bash
./install.sh
```

This will:
1. Install the bridge as a systemd user service
2. Copy all KWin scripts to `~/.local/share/kwin/scripts/`
3. Enable all scripts in KWin config
4. Start the bridge and reconfigure KWin

### Selective Installation

If you only want specific features, install the bridge, then manually copy only the scripts you need:

```bash
# Always needed: start the bridge
systemctl --user start kwin-dbus-bridge.service

# Copy only the scripts you want
cp -r scripts/kwin-dbus-active-window ~/.local/share/kwin/scripts/
kwriteconfig6 --file kwinrc --group Plugins --key kwin-dbus-active-windowEnabled true
qdbus6 org.kde.KWin /KWin reconfigure
```

### Uninstall

```bash
./uninstall.sh
```

## D-Bus API Reference

**Service name:** `org.kde.kwin.Scripted`

### Active Window — `/ActiveWindow`

**Interface:** `org.kde.kwin.Scripted.ActiveWindow`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `Get` | `() → s` | Get current active window as JSON |
| Signal | `Changed` | `(s json)` | Emitted when active window changes |

### Windows — `/Windows`

**Interface:** `org.kde.kwin.Scripted.Windows`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `GetAll` | `() → s` | Get all windows as JSON array |
| Method | `GetById` | `(s id) → s` | Get window by internalId |
| Method | `QueryByName` | `(s name) → s` | Find windows where caption contains name (case-insensitive) |
| Method | `QueryByClass` | `(s class) → s` | Find windows where resourceClass matches (case-insensitive) |
| Method | `QueryByPid` | `(i pid) → s` | Find windows by process ID |
| Signal | `Added` | `(s json)` | Emitted when a window is created |
| Signal | `Removed` | `(s id)` | Emitted when a window is destroyed |

### Properties — `/Properties`

**Interface:** `org.kde.kwin.Scripted.Properties`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `Get` | `(s id) → s` | Get all properties for a window |
| Signal | `Changed` | `(s id, s property, s value)` | Emitted when any tracked property changes |

**Tracked properties:** caption, minimized, fullScreen, maximized, active, keepAbove, keepBelow, shade, opacity, desktops, activities, skipTaskbar, skipPager, skipSwitcher, resourceClass, windowRole, noBorder, hidden, unresponsive, output, desktopFileName, tile, colorScheme, decoration, closeable

### Desktop — `/Desktop`

**Interface:** `org.kde.kwin.Scripted.Desktop`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `GetCurrent` | `() → s` | Get current desktop as JSON |
| Method | `GetAll` | `() → s` | Get all desktops as JSON array |
| Method | `GetCurrentActivity` | `() → s` | Get current activity ID |
| Signal | `Changed` | `(s json)` | Emitted when current desktop changes |
| Signal | `ActivityChanged` | `(s id)` | Emitted when current activity changes |

### Geometry — `/Geometry`

**Interface:** `org.kde.kwin.Scripted.Geometry`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `Get` | `(s id) → s` | Get window geometry as JSON |
| Signal | `Changed` | `(s id, s json)` | Emitted when window geometry changes |

### Cursor — `/Cursor`

**Interface:** `org.kde.kwin.Scripted.Cursor`

| Type | Name | Signature | Description |
|------|------|-----------|-------------|
| Method | `GetPosition` | `() → s` | Get cursor position as `{"x": N, "y": N}` |
| Signal | `Moved` | `(d x, d y)` | Emitted when cursor moves |

### Bridge (Internal) — `/Bridge`

**Interface:** `org.kde.kwin.Scripted.Bridge`

Used by KWin scripts to push data. External consumers should use the other interfaces above.

| Method | Signature | Description |
|--------|-----------|-------------|
| `Ping` | `() → s` | Health check, returns "pong" |
| `UpdateActiveWindow` | `(s json)` | Push active window data |
| `UpdateWindowList` | `(s json)` | Push full window list |
| `NotifyWindowAdded` | `(s json)` | Notify window created |
| `NotifyWindowRemoved` | `(s id)` | Notify window destroyed |
| `NotifyWindowPropertyChanged` | `(s id, s prop, s val)` | Push property change |
| `NotifyDesktopChanged` | `(s json)` | Push desktop change |
| `UpdateDesktopList` | `(s json)` | Push full desktop list |
| `NotifyActivityChanged` | `(s id)` | Push activity change |
| `NotifyGeometryChanged` | `(s id, s json)` | Push geometry change |
| `NotifyCursorMoved` | `(d x, d y)` | Push cursor position |

## Usage Examples

### Query active window

```bash
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /ActiveWindow org.kde.kwin.Scripted.ActiveWindow.Get
```

### Find windows by class

```bash
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /Windows org.kde.kwin.Scripted.Windows.QueryByClass string:"firefox"
```

### Find windows by name

```bash
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /Windows org.kde.kwin.Scripted.Windows.QueryByName string:"GitHub"
```

### List all windows

```bash
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /Windows org.kde.kwin.Scripted.Windows.GetAll
```

### Monitor active window changes

```bash
dbus-monitor "type='signal',interface='org.kde.kwin.Scripted.ActiveWindow'"
```

### Monitor all property changes

```bash
dbus-monitor "type='signal',interface='org.kde.kwin.Scripted.Properties'"
```

### Monitor cursor position

```bash
dbus-monitor "type='signal',interface='org.kde.kwin.Scripted.Cursor'"
```

### Get cursor position

```bash
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /Cursor org.kde.kwin.Scripted.Cursor.GetPosition
```

### Python client example

```python
import dbus
import json

bus = dbus.SessionBus()

# Get active window
active = bus.get_object("org.kde.kwin.Scripted", "/ActiveWindow")
iface = dbus.Interface(active, "org.kde.kwin.Scripted.ActiveWindow")
window = json.loads(iface.Get())
print(f"Active: {window.get('caption')} ({window.get('resourceClass')})")

# Query by class
windows = bus.get_object("org.kde.kwin.Scripted", "/Windows")
win_iface = dbus.Interface(windows, "org.kde.kwin.Scripted.Windows")
results = json.loads(win_iface.QueryByClass("firefox"))
for w in results:
    print(f"  {w['caption']} - {w['x']}x{w['y']} {w['width']}x{w['height']}")
```

## Window JSON Format

Each window is serialized with these fields:

```json
{
    "internalId": "abc123-...",
    "caption": "Window Title",
    "resourceName": "app-name",
    "resourceClass": "AppClass",
    "windowRole": "",
    "desktopFileName": "org.app.desktop",
    "pid": 12345,
    "x": 100, "y": 200, "width": 800, "height": 600,
    "opacity": 1.0,
    "active": true,
    "fullScreen": false,
    "minimized": false,
    "keepAbove": false,
    "keepBelow": false,
    "noBorder": false,
    "skipTaskbar": false,
    "skipPager": false,
    "onAllDesktops": false,
    "shade": false,
    "normalWindow": true,
    "dialog": false,
    "dock": false,
    "specialWindow": false,
    "windowType": 0,
    "layer": 4,
    "stackingOrder": 3,
    "output": "HDMI-1",
    "desktops": [{"id": "abc", "name": "Desktop 1", "x11DesktopNumber": 1}],
    "activities": ["activity-uuid"]
}
```

## Troubleshooting

### Bridge not responding

```bash
# Check if bridge is running
systemctl --user status kwin-dbus-bridge.service

# Start with verbose logging
~/.../bridge/kwin-dbus-bridge.py --verbose

# Test connectivity
dbus-send --session --print-reply --dest=org.kde.kwin.Scripted \
    /Bridge org.kde.kwin.Scripted.Bridge.Ping
```

### Scripts not loaded

```bash
# Check which scripts are enabled
grep -i "kwin-dbus" ~/.config/kwinrc

# Force KWin to reload scripts
qdbus6 org.kde.KWin /KWin reconfigure
```

### No data being received

1. Ensure the bridge is running **before** KWin loads the scripts
2. Check KWin script logs: `journalctl --user -u kwin.service -f`
3. Run bridge with `--verbose` to see incoming data

## License

GPL-3.0
