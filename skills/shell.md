---
name: shell
description: Execute safe shell commands (allowlisted by governance)
---

# Shell Commands

Execute shell commands that are allowed by the governance policy.

## Allowed Commands

By default, these commands are allowed:
- `ls` - List files
- `pwd` - Print working directory
- `cat` - Display file contents
- `grep` - Search text
- `find` - Find files
- `df` - Disk usage
- `du` - Directory usage
- `ps` - Process list
- `curl` - Make HTTP requests
- `git` - Git operations (safe ones)

## Usage

```bash
# List files
/exec ls -la ~/Documents

# Search for text
/exec grep -r "TODO" ~/Projects

# Check disk space
/exec df -h
```

## Denied Commands

These commands are explicitly denied for safety:
- `rm` - Remove files (too dangerous)
- `sudo` - Superuser (security risk)
- `dd` - Disk operations (destructive)
- `mkfs` - Format disk (destructive)
- `shutdown` - System control
- `reboot` - System control

## Confirmation Required

These commands require user confirmation:
- `mv` - Move files
- `cp` - Copy files
- `git push` - Push to remote
- `npm publish` - Publish package
