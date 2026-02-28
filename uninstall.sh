#!/usr/bin/env bash
set -euo pipefail

KWIN_SCRIPTS_DIR="${HOME}/.local/share/kwin/scripts"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

echo "=== KWin D-Bus Bridge Uninstaller ==="
echo ""

# --- Stop and remove bridge service ---
echo "[1/3] Removing bridge service..."
systemctl --user stop kwin-dbus-bridge.service 2>/dev/null || true
systemctl --user disable kwin-dbus-bridge.service 2>/dev/null || true
rm -f "${SYSTEMD_USER_DIR}/kwin-dbus-bridge.service"
systemctl --user daemon-reload
echo "  Bridge service removed."

# --- Remove KWin scripts ---
echo ""
echo "[2/3] Removing KWin scripts..."

SCRIPTS=(
    "kwin-dbus-active-window"
    "kwin-dbus-windows"
    "kwin-dbus-window-properties"
    "kwin-dbus-desktop"
    "kwin-dbus-geometry"
    "kwin-dbus-cursor"
)

for script in "${SCRIPTS[@]}"; do
    dest="${KWIN_SCRIPTS_DIR}/${script}"
    if [ -d "${dest}" ]; then
        rm -rf "${dest}"
        echo "  Removed: ${script}"
    fi
done

# --- Disable scripts in config ---
echo ""
echo "[3/3] Disabling KWin scripts..."

for script in "${SCRIPTS[@]}"; do
    if command -v kwriteconfig6 &>/dev/null; then
        kwriteconfig6 --file kwinrc --group Plugins --key "${script}Enabled" --delete 2>/dev/null || true
    elif command -v kwriteconfig5 &>/dev/null; then
        kwriteconfig5 --file kwinrc --group Plugins --key "${script}Enabled" --delete 2>/dev/null || true
    fi
done

# --- Reconfigure KWin ---
echo ""
echo "Reconfiguring KWin..."
if command -v qdbus6 &>/dev/null; then
    qdbus6 org.kde.KWin /KWin reconfigure 2>/dev/null || true
elif command -v qdbus &>/dev/null; then
    qdbus org.kde.KWin /KWin reconfigure 2>/dev/null || true
fi

echo ""
echo "=== Uninstallation complete ==="
