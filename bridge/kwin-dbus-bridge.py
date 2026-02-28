#!/usr/bin/env python3
"""KWin D-Bus Bridge Service.

Registers org.kde.kwin.Scripted on the session bus and provides a bridge
between KWin scripts (which push data via callDBus) and external D-Bus consumers.
"""

import argparse
import json
import logging
import signal
import sys

import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

LOG = logging.getLogger("kwin-dbus-bridge")

BUS_NAME = "org.kde.kwin.Scripted"
IFACE_BRIDGE = f"{BUS_NAME}.Bridge"
IFACE_ACTIVE = f"{BUS_NAME}.ActiveWindow"
IFACE_WINDOWS = f"{BUS_NAME}.Windows"
IFACE_PROPS = f"{BUS_NAME}.Properties"
IFACE_DESKTOP = f"{BUS_NAME}.Desktop"
IFACE_GEOMETRY = f"{BUS_NAME}.Geometry"
IFACE_CURSOR = f"{BUS_NAME}.Cursor"


class WindowStore:
    """Shared cached state for all D-Bus objects."""

    def __init__(self):
        self.active_window = None
        self.windows = {}
        self.current_desktop = None
        self.all_desktops = []
        self.current_activity = ""
        self.cursor_x = 0.0
        self.cursor_y = 0.0


def _parse_json(raw, fallback=None):
    """Parse JSON string, returning *fallback* on error."""
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        LOG.error("JSON parse error: %s", exc)
        return fallback


# -- Public-facing objects ---------------------------------------------------

class ActiveWindowObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/ActiveWindow")
        self._store = store

    @dbus.service.method(IFACE_ACTIVE, in_signature="", out_signature="s")
    def Get(self):
        return json.dumps(self._store.active_window or {})

    @dbus.service.signal(IFACE_ACTIVE, signature="s")
    def Changed(self, json_data):
        pass


class WindowsObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/Windows")
        self._store = store

    @dbus.service.method(IFACE_WINDOWS, in_signature="", out_signature="s")
    def GetAll(self):
        return json.dumps(list(self._store.windows.values()))

    @dbus.service.method(IFACE_WINDOWS, in_signature="s", out_signature="s")
    def GetById(self, window_id):
        win = self._store.windows.get(window_id)
        return json.dumps(win or {})

    @dbus.service.method(IFACE_WINDOWS, in_signature="s", out_signature="s")
    def QueryByName(self, name):
        needle = name.lower()
        results = [
            w for w in self._store.windows.values()
            if needle in w.get("caption", "").lower()
        ]
        return json.dumps(results)

    @dbus.service.method(IFACE_WINDOWS, in_signature="s", out_signature="s")
    def QueryByClass(self, class_name):
        needle = class_name.lower()
        results = [
            w for w in self._store.windows.values()
            if w.get("resourceClass", "").lower() == needle
        ]
        return json.dumps(results)

    @dbus.service.method(IFACE_WINDOWS, in_signature="i", out_signature="s")
    def QueryByPid(self, pid):
        results = [
            w for w in self._store.windows.values()
            if w.get("pid") == pid
        ]
        return json.dumps(results)

    @dbus.service.signal(IFACE_WINDOWS, signature="s")
    def Added(self, json_data):
        pass

    @dbus.service.signal(IFACE_WINDOWS, signature="s")
    def Removed(self, window_id):
        pass


class PropertiesObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/Properties")
        self._store = store

    @dbus.service.method(IFACE_PROPS, in_signature="s", out_signature="s")
    def Get(self, window_id):
        win = self._store.windows.get(window_id)
        return json.dumps(win or {})

    @dbus.service.signal(IFACE_PROPS, signature="sss")
    def Changed(self, window_id, property_name, json_value):
        pass


class DesktopObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/Desktop")
        self._store = store

    @dbus.service.method(IFACE_DESKTOP, in_signature="", out_signature="s")
    def GetCurrent(self):
        return json.dumps(self._store.current_desktop or {})

    @dbus.service.method(IFACE_DESKTOP, in_signature="", out_signature="s")
    def GetAll(self):
        return json.dumps(self._store.all_desktops)

    @dbus.service.method(IFACE_DESKTOP, in_signature="", out_signature="s")
    def GetCurrentActivity(self):
        return self._store.current_activity

    @dbus.service.signal(IFACE_DESKTOP, signature="s")
    def Changed(self, json_data):
        pass

    @dbus.service.signal(IFACE_DESKTOP, signature="s")
    def ActivityChanged(self, activity_id):
        pass


class GeometryObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/Geometry")
        self._store = store

    @dbus.service.method(IFACE_GEOMETRY, in_signature="s", out_signature="s")
    def Get(self, window_id):
        win = self._store.windows.get(window_id)
        if win is None:
            return json.dumps({})
        geom = {
            k: win[k] for k in ("x", "y", "width", "height")
            if k in win
        }
        return json.dumps(geom)

    @dbus.service.signal(IFACE_GEOMETRY, signature="ss")
    def Changed(self, window_id, json_data):
        pass


class CursorObject(dbus.service.Object):
    def __init__(self, bus, store):
        super().__init__(bus, "/Cursor")
        self._store = store

    @dbus.service.method(IFACE_CURSOR, in_signature="", out_signature="s")
    def GetPosition(self):
        return json.dumps({"x": self._store.cursor_x, "y": self._store.cursor_y})

    @dbus.service.signal(IFACE_CURSOR, signature="dd")
    def Moved(self, x, y):
        pass


# -- Internal bridge object --------------------------------------------------

class BridgeObject(dbus.service.Object):
    """Receives pushes from KWin scripts and dispatches to public objects."""

    def __init__(self, bus, store, active_win, windows, properties,
                 desktop, geometry, cursor):
        super().__init__(bus, "/Bridge")
        self._store = store
        self._active_win = active_win
        self._windows = windows
        self._properties = properties
        self._desktop = desktop
        self._geometry = geometry
        self._cursor = cursor

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def UpdateActiveWindow(self, json_data):
        data = _parse_json(json_data)
        if data is None:
            return
        self._store.active_window = data
        LOG.debug("Active window updated: %s", data.get("caption", ""))
        self._active_win.Changed(json_data)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def NotifyWindowAdded(self, json_data):
        data = _parse_json(json_data)
        if data is None:
            return
        wid = data.get("internalId", "")
        self._store.windows[wid] = data
        LOG.debug("Window added: %s (%s)", data.get("caption", ""), wid)
        self._windows.Added(json_data)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def NotifyWindowRemoved(self, window_id):
        self._store.windows.pop(str(window_id), None)
        LOG.debug("Window removed: %s", window_id)
        self._windows.Removed(window_id)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def UpdateWindowList(self, json_array):
        data = _parse_json(json_array, fallback=[])
        if not isinstance(data, list):
            LOG.error("UpdateWindowList expected array, got %s", type(data).__name__)
            return
        self._store.windows = {
            w.get("internalId", ""): w for w in data if isinstance(w, dict)
        }
        LOG.debug("Window list replaced (%d windows)", len(self._store.windows))

    @dbus.service.method(IFACE_BRIDGE, in_signature="sss", out_signature="")
    def NotifyWindowPropertyChanged(self, window_id, property_name, json_value):
        wid = str(window_id)
        value = _parse_json(json_value)
        if wid in self._store.windows and value is not None:
            self._store.windows[wid][str(property_name)] = value
        LOG.debug("Property changed: %s.%s", wid, property_name)
        self._properties.Changed(window_id, property_name, json_value)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def NotifyDesktopChanged(self, json_data):
        data = _parse_json(json_data)
        if data is None:
            return
        self._store.current_desktop = data
        LOG.debug("Desktop changed: %s", data)
        self._desktop.Changed(json_data)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def UpdateDesktopList(self, json_array):
        data = _parse_json(json_array, fallback=[])
        if isinstance(data, list):
            self._store.all_desktops = data
            LOG.debug("Desktop list updated (%d desktops)", len(data))
        else:
            LOG.error("UpdateDesktopList expected array, got %s", type(data).__name__)

    @dbus.service.method(IFACE_BRIDGE, in_signature="s", out_signature="")
    def NotifyActivityChanged(self, activity_id):
        self._store.current_activity = str(activity_id)
        LOG.debug("Activity changed: %s", activity_id)
        self._desktop.ActivityChanged(activity_id)

    @dbus.service.method(IFACE_BRIDGE, in_signature="ss", out_signature="")
    def NotifyGeometryChanged(self, window_id, json_geometry):
        data = _parse_json(json_geometry)
        if data is not None:
            wid = str(window_id)
            if wid in self._store.windows:
                self._store.windows[wid].update(data)
        LOG.debug("Geometry changed: %s", window_id)
        self._geometry.Changed(window_id, json_geometry)

    @dbus.service.method(IFACE_BRIDGE, in_signature="dd", out_signature="")
    def NotifyCursorMoved(self, x, y):
        self._store.cursor_x = float(x)
        self._store.cursor_y = float(y)
        LOG.debug("Cursor moved: %.0f, %.0f", x, y)
        self._cursor.Moved(x, y)

    @dbus.service.method(IFACE_BRIDGE, in_signature="", out_signature="s")
    def Ping(self):
        return "pong"


# -- Entry point -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="KWin D-Bus Bridge Service")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()

    bus_name = dbus.service.BusName(BUS_NAME, bus)

    store = WindowStore()

    active_win = ActiveWindowObject(bus_name, store)
    windows = WindowsObject(bus_name, store)
    properties = PropertiesObject(bus_name, store)
    desktop = DesktopObject(bus_name, store)
    geometry = GeometryObject(bus_name, store)
    cursor = CursorObject(bus_name, store)

    _bridge = BridgeObject(
        bus_name, store,
        active_win, windows, properties,
        desktop, geometry, cursor,
    )

    loop = GLib.MainLoop()

    def _shutdown(signum, _frame):
        LOG.info("Received signal %d, shutting down", signum)
        loop.quit()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    LOG.info("KWin D-Bus bridge running on %s", BUS_NAME)
    loop.run()


if __name__ == "__main__":
    main()
