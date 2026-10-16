# Mic Toggle (MB4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press Mouse Button 4 toggles mute on all mics with no Back-navigation firing, on any app.

**Architecture:** One Python daemon uses evdev exclusive-grab on mouse event nodes to swallow BTN_SIDE, forwards all other input via uinput, and flips every Pulse/PipeWire source with pactl.

**Tech Stack:** Python 3.14, python-evdev (pip), pactl (PipeWire/Pulse compat 17.0), systemd user service, udev rule + `input` group.

**Spec:** `docs/superpowers/specs/2026-10-04-mic-toggle-design.md`

## Global Constraints

- Toggle-per-click on BTN_SIDE (code 275) press edge only (`value==1`), 300 ms debounce.
- Mute scope = ALL sources from `pactl list sources short`; if any unmuted → mute all, else unmute all.
- Silent: no notify-send, no tray, no OSD; stdout log line only.
- Suppress Back: `device.grab()` + uinput forward-all-except-BTN_SIDE; `--no-grab` fallback restores Back.
- Universal: works Wayland + X11, any focused app; mouse move/wheel/left/right/middle unaffected.
- Fallback order for audio: `pactl` → `wpctl`; missing uinput/input perms print one-line fix hint, exit 2.

---

### Task 1: Audio toggler core (no hardware needed)

**Files:**
- Create: `mic-toggle/mic_toggle.py`
- Test: `mic-toggle/test_toggle.py`

**Interfaces:**
- Consumes: `pactl` CLI (`list sources short`, `get-source-mute <n>`, `set-source-mute <n> 0|1`).
- Produces: `list_sources(run) -> list[str]`, `is_muted(run, src) -> bool`, `toggle_all(run=...) -> str ("muted"|"unmuted")` used by Task 2.

- [ ] **Step 1: Write the failing test**

```python
# mic-toggle/test_toggle.py
from unittest.mock import Mock
from mic_toggle import list_sources, toggle_all

def fake_run_factory(state):
    def fake_run(cmd):
        if cmd[:3] == ["pactl", "list", "sources"]:
            return "0\talsa_input.pci\tPipeWire\ts32le\t2ch\tRUNNING\n1\talsa_input.usb\tPipeWire\ts16le\t1ch\tIDLE\n"
        if cmd[0:2] == ["pactl", "get-source-mute"]:
            return f"Mute: {'yes' if state[cmd[2]] else 'no'}\n"
        if cmd[0:2] == ["pactl", "set-source-mute"]:
            state[cmd[2]] = (cmd[3] == "1")
            return ""
        raise AssertionError(cmd)
    return fake_run

def test_toggle_mutes_all_when_any_live():
    state = {"0": False, "1": True}
    assert toggle_all(run=fake_run_factory(state)) == "muted"
    assert state == {"0": True, "1": True}

def test_toggle_unmutes_all_when_all_muted():
    state = {"0": True, "1": True}
    assert toggle_all(run=fake_run_factory(state)) == "unmuted"
    assert state == {"0": False, "1": False}

def test_list_sources_parses_ids():
    run = Mock(return_value="0\talsa_input.pci\tPipeWire\ts32le\t2ch\tRUNNING\n")
    assert list_sources(run) == ["0"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest mic-toggle/test_toggle.py -v`
Expected: FAIL with "No module named mic_toggle" or "cannot import".

- [ ] **Step 3: Write minimal implementation (toggler only, argparse stub included)**

```python
#!/usr/bin/env python3
"""MB4 mic toggle. Task 1: audio core. Task 2 adds evdev listener."""
import argparse, subprocess, sys, time

BTN_SIDE = 275
DEBOUNCE_S = 0.30

def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout

def list_sources(run=_run):
    out = run(["pactl", "list", "sources", "short"])
    ids = []
    for line in out.splitlines():
        parts = line.split("\t")
        if parts and parts[0].strip().isdigit():
            ids.append(parts[0].strip())
    return ids

def is_muted(run, src):
    return "yes" in run(["pactl", "get-source-mute", src]).lower()

def toggle_all(run=_run):
    try:
        srcs = list_sources(run)
    except FileNotFoundError:
        raise SystemExit("mic-toggle: pactl not found — install pulseaudio-utils (pactl) or wireplumber (wpctl fallback TODO)")
    if not srcs:
        print("mic-toggle: no sources found", file=sys.stderr)
        raise SystemExit(1)
    target = "0" if all(is_muted(run, s) for s in srcs) else "1"
    for s in srcs:
        run(["pactl", "set-source-mute", s, target])
    return "muted" if target == "1" else "unmuted"

def main():
    p = argparse.ArgumentParser(description="MB4 mic toggle")
    p.add_argument("--toggle", action="store_true", help="flip all mics once and exit")
    p.add_argument("--list", action="store_true", help="list evdev mouse candidates (Task 2)")
    p.add_argument("--device", action="append", default=[], help="pin /dev/input/eventX (repeatable)")
    p.add_argument("--no-grab", action="store_true", help="listen without grab (Back NOT suppressed)")
    a = p.parse_args()
    if a.toggle:
        print(toggle_all())
        return
    print("listener lands in Task 2; use --toggle for now")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest mic-toggle/test_toggle.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Manual check against real PipeWire**

Run: `python3 mic-toggle/mic_toggle.py --toggle && pactl get-source-mute @DEFAULT_SOURCE@`
Expected: prints `muted`/`unmuted` and second command shows matching `Mute: yes/no`; run twice to flip back.

- [ ] **Step 6: Commit**

```bash
git add mic-toggle/mic_toggle.py mic-toggle/test_toggle.py
git commit -m "feat(mic-toggle): toggle-all-mics core with tests"
```

### Task 2: MB4 listener with Back-suppress (grab + uinput forward)

**Files:**
- Modify: `mic-toggle/mic_toggle.py`
- Test: `mic-toggle/test_debounce.py`

**Interfaces:**
- Consumes: `toggle_all(run)` from Task 1; `evdev.InputDevice`, `evdev.UInput`, `evdev.ecodes`.
- Produces: `should_toggle(code, value, now, last) -> bool`, `run_listener(devices, grab)` used by Task 3 service.

- [ ] **Step 1: Write the failing test (pure debounce logic, no hardware)**

```python
# mic-toggle/test_debounce.py
from mic_toggle import should_toggle, BTN_SIDE
from evdev import ecodes

def test_press_toggles_release_does_not():
    assert should_toggle(BTN_SIDE, 1, 10.0, 0.0) is True
    assert should_toggle(BTN_SIDE, 0, 10.5, 10.0) is False
    assert should_toggle(BTN_SIDE, 2, 10.5, 10.0) is False  # autorepeat

def test_debounce_blocks_rapid_second_press():
    assert should_toggle(BTN_SIDE, 1, 10.0, 0.0) is True
    assert should_toggle(BTN_SIDE, 1, 10.1, 10.0) is False
    assert should_toggle(BTN_SIDE, 1, 10.5, 10.0) is True

def test_other_buttons_ignored():
    assert should_toggle(ecodes.BTN_LEFT, 1, 10.0, 0.0) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest mic-toggle/test_debounce.py -v`
Expected: FAIL with "cannot import should_toggle".

- [ ] **Step 3: Write minimal implementation (append to mic_toggle.py, keep Task 1 code)**

```python
def should_toggle(code, value, now, last):
    from evdev import ecodes
    if code != BTN_SIDE or value != 1:
        return False
    return (now - last) >= DEBOUNCE_S
```

Plus listener (same file, below `toggle_all`):

```python
def find_mice():
    from evdev import InputDevice, ecodes
    import glob
    found = []
    for path in sorted(glob.glob("/dev/input/event*")):
        try:
            d = InputDevice(path)
            caps = d.capabilities().get(ecodes.EV_KEY, [])
            if BTN_SIDE in caps and ("mouse" in d.name.lower() or ecodes.BTN_LEFT in caps):
                found.append((path, d.name))
        except PermissionError:
            found.append((path, "no-permission"))
        except OSError:
            pass
    return found

def run_listener(device_paths, grab=True):
    from evdev import InputDevice, UInput, ecodes
    import select, time
    print(f"mic-toggle: listening grab={grab} on {device_paths}", flush=True)
    while True:  # outer rescan loop for unplug/replug
        try:
            devs = [InputDevice(p) for p in device_paths]
            ui = None
            if grab:
                caps = {ec: devs[0].capabilities().get(ec, []) for ec in (ecodes.EV_KEY, ecodes.EV_REL, ecodes.EV_MSC)}
                ui = UInput(caps, name="mic-toggle-forward")
                for d in devs:
                    d.grab()
            last = 0.0
            try:
                while True:
                    r, _, _ = select.select(devs, [], [], 2.0)
                    for d in r:
                        for ev in d.read():
                            if ev.type == ecodes.EV_KEY and ev.code == BTN_SIDE:
                                if ev.value == 1 and should_toggle(ev.code, ev.value, ev.timestamp(), last):
                                    last = ev.timestamp()
                                    print(f"mic-toggle: {toggle_all()}", flush=True)
                                continue  # never forward BTN_SIDE
                            if ui is not None:
                                ui.write(ev.type, ev.code, ev.value)
                                if ev.type == ecodes.EV_SYN:
                                    ui.syn()
            finally:
                for d in devs:
                    try: d.ungrab()
                    except OSError: pass
        except OSError:
            time.sleep(2.0)
            continue
```

Wire `--list` to print `find_mice()` and default main to `run_listener(device_paths or [p for p,_ in find_mice()], grab=not args.no_grab)`. Wrap `PermissionError` with: `print("mic-toggle: permission denied — run: sudo usermod -aG input $USER && sudo modprobe uinput; then relogin", file=sys.stderr); raise SystemExit(2)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m pytest mic-toggle/ -v`
Expected: PASS (6 passed: 3 toggle + 3 debounce)

- [ ] **Step 5: Hardware check (needs input group, one command)**

Run: `python3 mic-toggle/mic_toggle.py --list`
Expected: lists Razer/receiver event nodes (or `no-permission` → apply group fix, relogin, retry).

- [ ] **Step 6: Commit**

```bash
git add mic-toggle/mic_toggle.py mic-toggle/test_debounce.py
git commit -m "feat(mic-toggle): grab MB4, suppress Back, forward rest via uinput"
```

### Task 3: Service + install + verify Back is gone

**Files:**
- Create: `mic-toggle/mic-toggle.service`
- Create: `mic-toggle/99-mic-toggle.rules`
- Create: `mic-toggle/install.sh`
- Create: `mic-toggle/README.md`

**Interfaces:**
- Consumes: `mic_toggle.py --list`, `run_listener` from Task 2.
- Produces: running `mic-toggle.service`, verified Back-suppressed MB4 toggle.

- [ ] **Step 1: Write service file**

```ini
# mic-toggle/mic-toggle.service
[Unit]
Description=MB4 mic toggle (suppress Back)
After=pipewire-pulse.service

[Service]
ExecStart=/usr/bin/python3 %h/Documents/opencode%sessions/mic-toggle/mic_toggle.py
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
```

Note: adjust `%h/...` path to actual absolute path of `mic_toggle.py` at install time (install.sh does sed replace).

- [ ] **Step 2: Write udev rule + install script**

```ini
# mic-toggle/99-mic-toggle.rules
KERNEL=="event*", SUBSYSTEM=="input", GROUP="input", MODE="0660"
KERNEL=="uinput", GROUP="input", MODE="0660"
```

```bash
#!/usr/bin/env bash
# mic-toggle/install.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
pip install --user evdev
sudo cp "$HERE/99-mic-toggle.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger || true
sudo modprobe uinput || true
if ! id -nG "$USER" | grep -qw input; then sudo usermod -aG input "$USER"; echo "added to input group — RELOGIN required"; fi
mkdir -p ~/.config/systemd/user
sed "s|ExecStart=.*|ExecStart=/usr/bin/python3 $HERE/mic_toggle.py|" "$HERE/mic-toggle.service" > ~/.config/systemd/user/mic-toggle.service
systemctl --user daemon-reload
systemctl --user enable --now mic-toggle.service
systemctl --user status mic-toggle.service --no-pager
```

Run: `chmod +x mic-toggle/install.sh`

- [ ] **Step 3: Write README (5 lines: what, install, verify, stop, unbind restore)**

```markdown
# mic-toggle
MB4 toggles ALL mics, Back-navigation removed.
- install: `./mic-toggle/install.sh` then relogin if group changed
- verify: click MB4 in browser → no Back + `pactl get-source-mute @DEFAULT_SOURCE@` flips
- logs: `journalctl --user -u mic-toggle -f`
- stop/restore Back: `systemctl --user stop mic-toggle.service`
- listen-only (keep Back): `python3 mic-toggle/mic_toggle.py --no-grab`
```

- [ ] **Step 4: Install and verify end-to-end**

Run: `./mic-toggle/install.sh`
Expected: service `active (running)`; then click MB4 in file manager/browser → stays on page (Back gone) + `pactl list sources` mute states flip each click; move/wheel/left/right unaffected; unplug/replug mouse → recovers in ≤5 s.

- [ ] **Step 5: Commit**

```bash
git add mic-toggle/mic-toggle.service mic-toggle/99-mic-toggle.rules mic-toggle/install.sh mic-toggle/README.md
git commit -m "feat(mic-toggle): user service, udev rule, installer"
```
