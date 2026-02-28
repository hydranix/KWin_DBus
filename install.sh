#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KWIN_SCRIPTS_DIR="${HOME}/.local/share/kwin/scripts"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

echo "=== KWin D-Bus Bridge Installer ==="
echo ""

# --- Install bridge service ---
echo "[1/3] Installing bridge service..."
mkdir -p "${SYSTEMD_USER_DIR}"

# Update ExecStart path to actual location
BRIDGE_PATH="${SCRIPT_DIR}/bridge/kwin-dbus-bridge.py"
chmod +x "${BRIDGE_PATH}"

# Generate service file with correct path
cat > "${SYSTEMD_USER_DIR}/kwin-dbus-bridge.service" <<EOF
[Unit]
Description=KWin D-Bus Bridge Service
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=${BRIDGE_PATH}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=graphical-session.target
EOF

systemctl --user daemon-reload
systemctl --user enable kwin-dbus-bridge.service
echo "  Bridge service installed and enabled."

# --- Install KWin scripts ---
echo ""
echo "[2/3] Installing KWin scripts..."
mkdir -p "${KWIN_SCRIPTS_DIR}"

SCRIPTS=(
    "kwin-dbus-active-window"
    "kwin-dbus-windows"
    "kwin-dbus-window-properties"
    "kwin-dbus-desktop"
    "kwin-dbus-geometry"
    "kwin-dbus-cursor"
)

for script in "${SCRIPTS[@]}"; do
    src="${SCRIPT_DIR}/scripts/${script}"
    dest="${KWIN_SCRIPTS_DIR}/${script}"
    if [ -d "${src}" ]; then
        rm -rf "${dest}"
        cp -r "${src}" "${dest}"
        echo "  Installed: ${script}"
    else
        echo "  WARNING: ${src} not found, skipping"
    fi
done

# --- Enable scripts via kwriteconfig6 ---
echo ""
echo "[3/3] Enabling KWin scripts..."

for script in "${SCRIPTS[@]}"; do
    # Enable each script in KWin config
    if command -v kwriteconfig6 &>/dev/null; then
        kwriteconfig6 --file kwinrc --group Plugins --key "${script}Enabled" true
    elif command -v kwriteconfig5 &>/dev/null; then
        kwriteconfig5 --file kwinrc --group Plugins --key "${script}Enabled" true
    else
        echo "  WARNING: kwriteconfig not found. Enable scripts manually in System Settings > Window Management > KWin Scripts"
    fi
    echo "  Enabled: ${script}"
done

# --- Start services ---
echo ""
echo "Starting bridge service..."
systemctl --user start kwin-dbus-bridge.service

echo ""
echo "Reconfiguring KWin to load scripts..."
if command -v qdbus6 &>/dev/null; then
    qdbus6 org.kde.KWin /KWin reconfigure 2>/dev/null || true
elif command -v qdbus &>/dev/null; then
    qdbus org.kde.KWin /KWin reconfigure 2>/dev/null || true
else
    echo "  Run 'qdbus org.kde.KWin /KWin reconfigure' manually or restart KWin"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "The bridge is running at: org.kde.kwin.Scripted"
echo "Test with: dbus-send --session --print-reply --dest=org.kde.kwin.Scripted /Bridge org.kde.kwin.Scripted.Bridge.Ping"
echo ""
echo "To selectively disable scripts, use System Settings > Window Management > KWin Scripts"
