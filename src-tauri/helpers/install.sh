#!/bin/bash
#
# AlarmMaster Wake Helper - Installer
# Compiles the Swift helper and installs it as a LaunchDaemon.
# Must be run with root privileges (via osascript with administrator privileges).
#
# Usage: install.sh <source-directory>
#

set -e

SOURCE_DIR="${1:-.}"
HELPER_NAME="AlarmMasterWakeHelper"
PLIST_NAME="com.alarmmaster.wake-helper.plist"
INSTALL_DIR="/usr/local/bin"
PLIST_DIR="/Library/LaunchDaemons"
SHARED_DIR="/Users/Shared/AlarmMaster"

echo "=== AlarmMaster Wake Helper Installer ==="
echo "Source directory: $SOURCE_DIR"

# 1. Create shared directory
echo "Creating shared directory..."
mkdir -p "$SHARED_DIR"
chmod 777 "$SHARED_DIR"

# 2. Unload existing daemon if present
if launchctl list | grep -q "com.alarmmaster.wake-helper"; then
    echo "Unloading existing daemon..."
    launchctl unload "$PLIST_DIR/$PLIST_NAME" 2>/dev/null || true
fi

# 3. Check for Swift compiler
if ! command -v swiftc &>/dev/null; then
    echo "ERROR: Swift compiler not found!"
    echo "Please install Xcode Command Line Tools: xcode-select --install"
    exit 1
fi

# 4. Compile Swift helper
echo "Compiling helper..."
SWIFT_SOURCE="$SOURCE_DIR/AlarmMasterWakeHelper.swift"

if [ ! -f "$SWIFT_SOURCE" ]; then
    echo "ERROR: Swift source not found at: $SWIFT_SOURCE"
    exit 1
fi

swiftc "$SWIFT_SOURCE" -o "/tmp/$HELPER_NAME" -O -whole-module-optimization

# 5. Install binary
echo "Installing binary to $INSTALL_DIR/$HELPER_NAME..."
mkdir -p "$INSTALL_DIR"
cp "/tmp/$HELPER_NAME" "$INSTALL_DIR/$HELPER_NAME"
chown root:wheel "$INSTALL_DIR/$HELPER_NAME"
chmod 755 "$INSTALL_DIR/$HELPER_NAME"
rm -f "/tmp/$HELPER_NAME"

# 6. Install LaunchDaemon plist
echo "Installing LaunchDaemon..."
PLIST_SOURCE="$SOURCE_DIR/$PLIST_NAME"

if [ ! -f "$PLIST_SOURCE" ]; then
    echo "ERROR: Plist not found at: $PLIST_SOURCE"
    exit 1
fi

cp "$PLIST_SOURCE" "$PLIST_DIR/$PLIST_NAME"
chown root:wheel "$PLIST_DIR/$PLIST_NAME"
chmod 644 "$PLIST_DIR/$PLIST_NAME"

# 7. Load daemon
echo "Loading daemon..."
launchctl load "$PLIST_DIR/$PLIST_NAME"

# 8. Verify installation
echo ""
echo "=== Installation Verification ==="
if [ -f "$INSTALL_DIR/$HELPER_NAME" ]; then
    echo "✓ Binary installed: $INSTALL_DIR/$HELPER_NAME"
else
    echo "✗ Binary NOT found"
fi

if [ -f "$PLIST_DIR/$PLIST_NAME" ]; then
    echo "✓ LaunchDaemon installed: $PLIST_DIR/$PLIST_NAME"
else
    echo "✗ LaunchDaemon NOT found"
fi

if launchctl list | grep -q "com.alarmmaster.wake-helper"; then
    echo "✓ Daemon loaded and running"
else
    echo "⚠ Daemon loaded but not yet triggered (will run when schedule changes)"
fi

echo ""
echo "=== Installation Complete ==="
echo "The helper will automatically wake your Mac when an alarm is scheduled."
