var BRIDGE_SERVICE = "org.kde.kwin.Scripted";
var BRIDGE_PATH = "/Bridge";
var BRIDGE_IFACE = "org.kde.kwin.Scripted.Bridge";

function sendPropertyChanged(w, propertyName, value) {
    var windowId = w.internalId ? w.internalId.toString() : "";
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE,
        "NotifyWindowPropertyChanged", windowId, propertyName, JSON.stringify(value));
}

function serializeDesktops(w) {
    var arr = [];
    if (w.desktops) {
        for (var i = 0; i < w.desktops.length; i++) {
            arr.push({
                id: w.desktops[i].id || "",
                name: w.desktops[i].name || "",
                x11DesktopNumber: w.desktops[i].x11DesktopNumber || 0
            });
        }
    }
    return arr;
}

function serializeActivities(w) {
    var arr = [];
    if (w.activities) {
        for (var i = 0; i < w.activities.length; i++) {
            arr.push(w.activities[i]);
        }
    }
    return arr;
}

// Safely connect a signal — if the signal doesn't exist, log and skip
function safeConnect(obj, signalName, handler) {
    try {
        if (obj[signalName] && typeof obj[signalName].connect === "function") {
            obj[signalName].connect(handler);
        }
    } catch (e) {
        // Signal may not exist on this KWin version
    }
}

function connectWindowSignals(w) {
    safeConnect(w, "captionChanged", function() {
        sendPropertyChanged(w, "caption", w.caption || "");
    });

    safeConnect(w, "minimizedChanged", function() {
        sendPropertyChanged(w, "minimized", !!w.minimized);
    });

    safeConnect(w, "fullScreenChanged", function() {
        sendPropertyChanged(w, "fullScreen", !!w.fullScreen);
    });

    safeConnect(w, "maximizedChanged", function() {
        sendPropertyChanged(w, "maximized", {
            horizontally: !!w.maximizedHorizontally,
            vertically: !!w.maximizedVertically
        });
    });

    safeConnect(w, "activeChanged", function() {
        sendPropertyChanged(w, "active", !!w.active);
    });

    safeConnect(w, "keepAboveChanged", function() {
        sendPropertyChanged(w, "keepAbove", !!w.keepAbove);
    });

    safeConnect(w, "keepBelowChanged", function() {
        sendPropertyChanged(w, "keepBelow", !!w.keepBelow);
    });

    safeConnect(w, "shadeChanged", function() {
        sendPropertyChanged(w, "shade", !!w.shade);
    });

    safeConnect(w, "opacityChanged", function() {
        sendPropertyChanged(w, "opacity", typeof w.opacity === "number" ? w.opacity : 1.0);
    });

    safeConnect(w, "desktopsChanged", function() {
        sendPropertyChanged(w, "desktops", serializeDesktops(w));
    });

    safeConnect(w, "activitiesChanged", function() {
        sendPropertyChanged(w, "activities", serializeActivities(w));
    });

    safeConnect(w, "skipTaskbarChanged", function() {
        sendPropertyChanged(w, "skipTaskbar", !!w.skipTaskbar);
    });

    safeConnect(w, "skipPagerChanged", function() {
        sendPropertyChanged(w, "skipPager", !!w.skipPager);
    });

    safeConnect(w, "skipSwitcherChanged", function() {
        sendPropertyChanged(w, "skipSwitcher", !!w.skipSwitcher);
    });

    safeConnect(w, "windowClassChanged", function() {
        sendPropertyChanged(w, "resourceClass", w.resourceClass || "");
    });

    safeConnect(w, "windowRoleChanged", function() {
        sendPropertyChanged(w, "windowRole", w.windowRole || "");
    });

    safeConnect(w, "noBorderChanged", function() {
        sendPropertyChanged(w, "noBorder", !!w.noBorder);
    });

    safeConnect(w, "hiddenChanged", function() {
        sendPropertyChanged(w, "hidden", !!w.hidden);
    });

    safeConnect(w, "unresponsiveChanged", function() {
        sendPropertyChanged(w, "unresponsive", !!w.unresponsive);
    });

    safeConnect(w, "outputChanged", function() {
        sendPropertyChanged(w, "output", w.output ? w.output.name : "");
    });

    safeConnect(w, "desktopFileNameChanged", function() {
        sendPropertyChanged(w, "desktopFileName", w.desktopFileName || "");
    });

    safeConnect(w, "tileChanged", function() {
        sendPropertyChanged(w, "tile", w.tile ? {
            x: w.tile.x || 0,
            y: w.tile.y || 0,
            width: w.tile.width || 0,
            height: w.tile.height || 0
        } : null);
    });

    safeConnect(w, "colorSchemeChanged", function() {
        sendPropertyChanged(w, "colorScheme", w.colorScheme || "");
    });

    safeConnect(w, "decorationChanged", function() {
        sendPropertyChanged(w, "decoration", !!w.decoration);
    });

    safeConnect(w, "closeableChanged", function() {
        sendPropertyChanged(w, "closeable", !!w.closeable);
    });
}

// Connect signals on all existing windows
var windows = workspace.stackingOrder;
for (var i = 0; i < windows.length; i++) {
    connectWindowSignals(windows[i]);
}

// Connect signals on newly added windows
workspace.windowAdded.connect(function(w) {
    connectWindowSignals(w);
});
