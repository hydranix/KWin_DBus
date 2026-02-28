var BRIDGE_SERVICE = "org.kde.kwin.Scripted";
var BRIDGE_PATH = "/Bridge";
var BRIDGE_IFACE = "org.kde.kwin.Scripted.Bridge";

var updateCounter = 0;
var THROTTLE_INTERVAL = 3; // Send every 3rd update

workspace.cursorPosChanged.connect(function() {
    updateCounter++;
    if (updateCounter % THROTTLE_INTERVAL !== 0) return;

    var pos = workspace.cursorPos;
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE,
        "NotifyCursorMoved", pos.x, pos.y);
});

// Send initial cursor position on load
var initialPos = workspace.cursorPos;
callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE,
    "NotifyCursorMoved", initialPos.x, initialPos.y);
