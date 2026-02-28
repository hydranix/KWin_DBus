var BRIDGE_SERVICE = "org.kde.kwin.Scripted";
var BRIDGE_PATH = "/Bridge";
var BRIDGE_IFACE = "org.kde.kwin.Scripted.Bridge";

function serializeWindow(w) {
    if (!w) return "null";
    return JSON.stringify({
        internalId: w.internalId ? w.internalId.toString() : "",
        caption: w.caption || "",
        resourceName: w.resourceName || "",
        resourceClass: w.resourceClass || "",
        windowRole: w.windowRole || "",
        desktopFileName: w.desktopFileName || "",
        pid: w.pid || 0,
        x: w.frameGeometry ? w.frameGeometry.x : 0,
        y: w.frameGeometry ? w.frameGeometry.y : 0,
        width: w.frameGeometry ? w.frameGeometry.width : 0,
        height: w.frameGeometry ? w.frameGeometry.height : 0,
        opacity: typeof w.opacity === "number" ? w.opacity : 1.0,
        active: !!w.active,
        fullScreen: !!w.fullScreen,
        fullScreenable: !!w.fullScreenable,
        minimized: !!w.minimized,
        minimizable: !!w.minimizable,
        maximizable: !!w.maximizable,
        closeable: !!w.closeable,
        moveable: !!w.moveable,
        resizeable: !!w.resizeable,
        keepAbove: !!w.keepAbove,
        keepBelow: !!w.keepBelow,
        noBorder: !!w.noBorder,
        skipTaskbar: !!w.skipTaskbar,
        skipPager: !!w.skipPager,
        skipSwitcher: !!w.skipSwitcher,
        onAllDesktops: !!w.onAllDesktops,
        shade: !!w.shade,
        normalWindow: !!w.normalWindow,
        dialog: !!w.dialog,
        dock: !!w.dock,
        toolbar: !!w.toolbar,
        menu: !!w.menu,
        splash: !!w.splash,
        utility: !!w.utility,
        notification: !!w.notification,
        specialWindow: !!w.specialWindow,
        desktopWindow: !!w.desktopWindow,
        popupWindow: !!w.popupWindow,
        transient: !!w.transient,
        modal: !!w.modal,
        managed: !!w.managed,
        hidden: !!w.hidden,
        unresponsive: !!w.unresponsive,
        windowType: w.windowType || 0,
        layer: w.layer || 0,
        stackingOrder: w.stackingOrder || 0,
        colorScheme: w.colorScheme || "",
        output: w.output ? w.output.name : "",
        desktops: (function() {
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
        })(),
        activities: (function() {
            var arr = [];
            if (w.activities) {
                for (var i = 0; i < w.activities.length; i++) {
                    arr.push(w.activities[i]);
                }
            }
            return arr;
        })()
    });
}

workspace.windowActivated.connect(function(w) {
    var json = serializeWindow(w);
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "UpdateActiveWindow", json);
});

// Send initial active window on script load
var initial = workspace.activeWindow;
if (initial) {
    var json = serializeWindow(initial);
    callDBus(BRIDGE_SERVICE, BRIDGE_PATH, BRIDGE_IFACE, "UpdateActiveWindow", json);
}
