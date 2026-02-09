---
name: weather
description: Get current weather (no API key required)
---

# Weather

Get weather using wttr.in (free, no API key needed).

## Usage

```bash
# Quick weather
/exec curl -s "wttr.in/London?format=3"
# Output: London: ⛅️ +8°C

# Detailed weather
/exec curl -s "wttr.in/London"
# Shows full forecast

# Specific location
/exec curl -s "wttr.in/NewYork?format=%l:+%c+%t"
# Output: New York: ⛅️ +15°C
```

## Format Options

- `%l` - Location name
- `%c` - Weather emoji
- `%t` - Temperature
- `%h` - Humidity
- `%w` - Wind speed
