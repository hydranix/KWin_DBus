var BRIDGE_SERVICE = "org.kde.kwin.Scripted";
var BRIDGE_PATH = "/Bridge";
var BRIDGE_IFACE = "org.kde.kwin.Scripted.Bridge";

function serializeGeometry(w) {
    return JSON.stringify({
        x: w.frameGeometry ? w.frameGeometry.x : 0,
        y: w.frameGeometry ? w.frameGeometry.y : 0,
        width: w.frameGeometry ? w.frameGeometry.width : 0,
        height: w.frameGeometry ? w.frameGeometry.height : 0,
        bufferX: w.bufferGeometry ? w.bufferGeometry.x : 0,
        bufferY: w.bufferGeometry ? w.bufferGeometry.y : 0,
        bufferWidth: w.bufferGeometry ? w.bufferGeometry.width : 0,
        bufferHeight: w.bufferGeometry ? w.bufferGeometry.height : 0
    });
}

function connectGeometrySignals(w) {
    w.frameGeometryChanged.connect(function() {
        var windowId = w.internalId.toString();
        var json = serializeGeometry(w);
        callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyGeometryChanged", windowId, json);
    });

    w.interactiveMoveResizeStarted.connect(function() {
        var windowId = w.internalId.toString();
        callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyWindowPropertyChanged",
            windowId, "interactiveMoveResize", JSON.stringify(true));
    });

    w.interactiveMoveResizeFinished.connect(function() {
        var windowId = w.internalId.toString();
        callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyWindowPropertyChanged",
            windowId, "interactiveMoveResize", JSON.stringify(false));
        var json = serializeGeometry(w);
        callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyGeometryChanged", windowId, json);
    });
}

// Connect to existing windows
var windows = workspace.stackingOrder;
for (var i = 0; i < windows.length; i++) {
    connectGeometrySignals(windows[i]);
}

// Connect to newly added windows
workspace.windowAdded.connect(function(w) {
    connectGeometrySignals(w);
});
