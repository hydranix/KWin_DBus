var BRIDGE_SERVICE = "org.kde.kwin.Scripted";
var BRIDGE_PATH = "/Bridge";
var BRIDGE_IFACE = "org.kde.kwin.Scripted.Bridge";

function serializeDesktop(d) {
    if (!d) return "null";
    return JSON.stringify({
        id: d.id || "",
        name: d.name || "",
        x11DesktopNumber: d.x11DesktopNumber || 0
    });
}

function serializeAllDesktops() {
    var arr = [];
    var desktops = workspace.desktops;
    for (var i = 0; i < desktops.length; i++) {
        arr.push({
            id: desktops[i].id || "",
            name: desktops[i].name || "",
            x11DesktopNumber: desktops[i].x11DesktopNumber || 0
        });
    }
    return JSON.stringify(arr);
}

function sendCurrentDesktop() {
    var d = workspace.currentDesktop;
    var json = serializeDesktop(d);
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyDesktopChanged", json);
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "UpdateDesktopList", serializeAllDesktops());
}

workspace.currentDesktopChanged.connect(function() {
    sendCurrentDesktop();
});

workspace.desktopsChanged.connect(function() {
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "UpdateDesktopList", serializeAllDesktops());
});

workspace.currentActivityChanged.connect(function(activityId) {
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyActivityChanged", activityId);
});

// Send initial state on load
sendCurrentDesktop();
callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "NotifyActivityChanged", workspace.currentActivity);
