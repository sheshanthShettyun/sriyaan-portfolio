# Mic Toggle (MB4, suppress Back) — Design

Date: 2026-10-04
Status: approved in chat (toggle-per-click, all mics, silent, suppress Back)

## 1. Goal
Universal mic mute toggle on Mouse Button 4 (BTN_SIDE, code 275).
Press MB4 → flip mute on ALL mic sources. Original MB4 Back-navigation
(Previous Screen) must NOT fire.

## 2. Context
- Fedora 44, PipeWire 1.6.8 (Pulse compat), Wayland default → must work on Wayland+X11, any focused app.
- Mice: Razer DeathAdder Essential + 2.4G wireless receiver (`/dev/input/by-id/*-event-mouse`).
- python3 available; no evtest/xbindkeys/xdotool. `evdev` + `uinput` via pip.
- Repo is Next.js portfolio — new standalone tool in `mic-toggle/`, unrelated to existing code.

## 3. Architecture
Single Python daemon + systemd user service:
- `mic-toggle/mic_toggle.py` — listener + toggler + uinput forwarder
- `mic-toggle/mic-toggle.service` — systemd user unit (restart always, start on login)
- `mic-toggle/install.sh` — pip install evdev, add user to `input` group, install udev rule for `/dev/input/*` + `uinput` access, enable service

## 4. Components
1. **Device picker:** enumerate `/dev/input/by-id/*-event-mouse` + `/dev/input/event*` with `EV_KEY/BTN_SIDE` caps. CLI `--list` prints candidates; `--device PATH` pins one; default = grab all mice with BTN_SIDE.
2. **Listener (evdev, exclusive grab):** `device.grab()` so kernel never delivers BTN_SIDE to compositor → Back suppressed. 300 ms debounce on press edge only (`value==1`).
3. **Forwarder (uinput):** virtual device re-emits every event EXCEPT BTN_SIDE press/release (REL_X/Y, wheel, BTN_LEFT/RIGHT/MIDDLE, BTN_EXTRA, keyboard bits if present). Mouse otherwise 100% normal.
4. **Toggler:** `pactl list sources short` → per source `pactl get-source-mute` → if any unmuted, `pactl set-source-mute <all> 1`, else `0`. Fallback order: `pactl` → `wpctl` → error to stderr. Silent: no notify-send, no tray (per user choice).
5. **Supervisor:** reconnect loop (poll for device add/remove every 2 s), PipeWire restart tolerant, single-instance lock.

## 5. Data flow
MB4 physical down → evdev EV_KEY BTN_SIDE=1 (grabbed, not forwarded) → debounce check → toggle-all-mics → nothing emitted. All other events → copied to uinput within <5 ms. Daemon stopped / `--no-grab` mode → no grab → Back behavior returns (escape hatch).

## 6. Error handling
- Permission denied on `/dev/input/event*` → print one-time: `sudo usermod -aG input $USER` + udev rule reload + relogin; exit 2.
- No `/dev/uinput` → print `sudo modprobe uinput` hint; offer `--no-grab` listen-only fallback (Back NOT suppressed, toggle still works).
- No sources found → stderr + exit 1, no crash loop.
- Debounce + press-only filtering prevents double-toggle on press+release+repeat.

## 7. Testing
- `python mic_toggle.py --list` shows Razer + receiver nodes.
- `python mic_toggle.py --toggle` flips once; verify with `pactl get-source-mute @DEFAULT_SOURCE@` and `pactl list sources`.
- Run daemon, click MB4 in browser (no Back nav) + Discord/Zoom (mic flips), move/wheel/left/right still work, unplug/replug mouse recovers.
- `journalctl --user -u mic-toggle -f` shows toggle lines only.

## 8. Non-goals
No GUI/tray/OSD/beep (silent per request — easy to add `--notify` later). X11-only tools out of scope. Push-to-talk out of scope.
