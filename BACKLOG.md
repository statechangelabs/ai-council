# Backlog

## `council install` — Cross-platform support

The `install` command currently only supports macOS (.app bundle). To support other platforms:

### Windows
- Create a `.lnk` shortcut or `.bat`/`.cmd` launcher in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`
- Alternatively, use a `.vbs` script to launch electron without a console window
- Shortcuts can be created programmatically via PowerShell or the `windows-shortcuts` npm package
- Replace `osascript` error dialog with a native alternative (e.g. PowerShell `[System.Windows.MessageBox]`)

### Linux
- Create a `.desktop` file in `~/.local/share/applications/`
- Simple text format similar in spirit to the macOS plist
