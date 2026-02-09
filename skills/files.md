---
name: files
description: List and read files in allowed directories
---

# File Operations

List and read files within allowed directories.

## Allowed Directories

By default, you can access:
- `~/Documents`
- `~/Downloads`
- `~/Projects`
- `~/Desktop`

## Usage

```bash
# List PDF files
/files ~/Documents/*.pdf

# List all files in directory
/files ~/Downloads

# Read a file
/read ~/Documents/notes.txt
```

## Denied Directories

These directories are off-limits:
- `/etc` - System configuration
- `/var` - System data
- `/usr` - System binaries
- `/System` - macOS system files
- `/bin`, `/sbin` - System binaries
