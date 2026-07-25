"""
ESR Tank Management System — Device Simulator
----------------------------------------------
Simulates one or more IoT devices sending data to the backend.
Use this for:
  - Backend development / testing without physical hardware
  - Load testing the API
  - Demonstrating the dashboard in real time

Usage:
  python device_simulator.py

Requirements:
  pip install requests

Configuration:
  Edit the CONFIG section below before running.
"""

import requests
import time
import random
import math
import threading
from datetime import datetime, timezone

# ─── Configuration ─────────────────────────────────────────────────────────────

CONFIG = {
    "base_url":    "http://localhost:5000",
    "api_path":    "/api/iot/data",
    "iot_secret":  "your_iot_device_shared_secret_key_change_in_production",
    "send_interval_sec": 60,    # Send every 60 seconds (matches real device)
    "fast_mode_sec":     5,     # Set to 5 for fast testing (shows realtime updates quickly)
}

# Define the devices to simulate.
# Each device maps to one registered tank in the database.
DEVICES = [
    {
        "device_id":   "DEV001",
        "base_flow":   120.0,    # Base flow rate L/min
        "flow_noise":  15.0,     # ± variation in flow rate
        "base_level":  75.0,     # Base water level %
        "level_noise": 3.0,      # ± variation in water level
    },
    {
        "device_id":   "DEV002",
        "base_flow":   95.0,
        "flow_noise":  10.0,
        "base_level":  60.0,
        "level_noise": 4.0,
    },
    {
        "device_id":   "DEV003",
        "base_flow":   200.0,
        "flow_noise":  25.0,
        "base_level":  40.0,
        "level_noise": 5.0,
    },
]

# ─── Device State (per device) ─────────────────────────────────────────────────

class DeviceState:
    def __init__(self, device_id: str, base_flow: float, flow_noise: float,
                 base_level: float = 50.0, level_noise: float = 3.0):
        self.device_id   = device_id
        self.base_flow   = base_flow
        self.flow_noise  = flow_noise
        self.base_level  = base_level
        self.level_noise = level_noise
        self.totalizer  = 0.0
        self.last_reset_date = datetime.now(timezone.utc).date()
        self.send_count = 0
        self.error_count = 0

    def get_flow_rate(self) -> float:
        """Simulate realistic flow rate with sinusoidal variation + noise."""
        hour        = datetime.now(timezone.utc).hour
        # Daily demand curve: lower at night, peak at morning and evening
        daily_curve = 0.7 + 0.3 * math.sin(math.pi * (hour - 6) / 12)
        noise       = random.uniform(-self.flow_noise, self.flow_noise)
        flow        = max(0.0, self.base_flow * daily_curve + noise)
        return round(flow, 2)

    def get_water_level(self) -> float:
        """Simulate the level transmitter reading as a % of tank capacity."""
        noise = random.uniform(-self.level_noise, self.level_noise)
        level = min(100.0, max(0.0, self.base_level + noise))
        return round(level, 1)

    def update_totalizer(self, flow_rate: float, elapsed_sec: float) -> float:
        """Accumulate totalizer: L = (L/min) × (sec / 60)."""
        volume_added  = (flow_rate / 60.0) * elapsed_sec
        self.totalizer = round(self.totalizer + volume_added, 2)
        return self.totalizer

    def check_midnight_reset(self):
        """Reset totalizer at midnight (daily)."""
        today = datetime.now(timezone.utc).date()
        if today != self.last_reset_date:
            print(f"  [{self.device_id}] 🔄 Midnight reset — totalizer cleared")
            self.totalizer        = 0.0
            self.last_reset_date  = today


# ─── HTTP Client ───────────────────────────────────────────────────────────────

def send_iot_data(state: DeviceState, flow_rate: float, totalizer: float, water_level: float) -> bool:
    url     = CONFIG["base_url"] + CONFIG["api_path"]
    headers = {
        "Content-Type":    "application/json",
        "X-Device-Secret": CONFIG["iot_secret"],
    }
    payload = {
        "deviceId":          state.device_id,
        "flowRate":          flow_rate,
        "totalizer":         totalizer,
        "waterLevelPercent": water_level,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)

        if response.status_code in (200, 201):
            data = response.json()
            print(
                f"  [{state.device_id}] ✓ Sent | "
                f"flow={flow_rate:.1f} L/min | "
                f"total={totalizer:.1f} L | "
                f"level={water_level:.1f}% | "
                f"tank={data.get('data', {}).get('tankName', '?')}"
            )
            return True
        else:
            print(
                f"  [{state.device_id}] ✗ HTTP {response.status_code} — "
                f"{response.json().get('message', 'unknown error')}"
            )
            return False

    except requests.exceptions.ConnectionError:
        print(f"  [{state.device_id}] ✗ Connection refused — is the server running?")
        return False
    except requests.exceptions.Timeout:
        print(f"  [{state.device_id}] ✗ Request timed out")
        return False
    except Exception as e:
        print(f"  [{state.device_id}] ✗ Error: {e}")
        return False


# ─── Device Run Loop ───────────────────────────────────────────────────────────

def run_device(cfg: dict, interval: float):
    state = DeviceState(
        device_id  = cfg["device_id"],
        base_flow  = cfg["base_flow"],
        flow_noise = cfg["flow_noise"],
    )

    print(f"[SIM] Device {state.device_id} started (interval={interval}s)")
    last_send_time = time.time()

    while True:
        now     = time.time()
        elapsed = now - last_send_time

        # Midnight reset check
        state.check_midnight_reset()

        # Get current readings
        flow_rate   = state.get_flow_rate()
        totalizer   = state.update_totalizer(flow_rate, elapsed)
        water_level = state.get_water_level()

        # Send to backend
        ok = send_iot_data(state, flow_rate, totalizer, water_level)
        if ok:
            state.send_count += 1
        else:
            state.error_count += 1

        last_send_time = now
        time.sleep(interval)


# ─── Health Check ──────────────────────────────────────────────────────────────

def check_server_health():
    try:
        r = requests.get(f"{CONFIG['base_url']}/health", timeout=5)
        if r.status_code == 200:
            info = r.json()
            print(f"  Server  : {info.get('message')}")
            print(f"  Env     : {info.get('environment')}")
            print(f"  Version : {info.get('version')}")
            return True
        else:
            print(f"  Server health check failed: HTTP {r.status_code}")
            return False
    except Exception as e:
        print(f"  Cannot reach server: {e}")
        return False


# ─── Entry Point ───────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  ESR Tank Management — Device Simulator")
    print("=" * 60)
    print(f"  URL    : {CONFIG['base_url']}{CONFIG['api_path']}")
    print(f"  Devices: {len(DEVICES)}")
    print()

    print("[CHECK] Server health:")
    if not check_server_health():
        print()
        print("  ⚠  Server is not reachable.")
        print("  Start the backend with: npm run dev")
        print()
        choice = input("  Continue anyway? [y/N]: ").strip().lower()
        if choice != 'y':
            return

    print()

    # Determine send interval (fast mode for testing)
    interval = CONFIG["fast_mode_sec"]
    print(f"[SIM] Using interval = {interval}s  (change fast_mode_sec in CONFIG)")
    print(f"[SIM] Starting {len(DEVICES)} device thread(s)...")
    print("-" * 60)

    threads = []
    for i, dev_cfg in enumerate(DEVICES):
        # Stagger device starts by 1 second to avoid simultaneous requests
        start_delay = i * 1.0
        t = threading.Timer(
            start_delay,
            run_device,
            args=(dev_cfg, interval)
        )
        t.daemon = True
        t.start()
        threads.append(t)

    print("[SIM] All devices running. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("\n[SIM] Stopped by user")


if __name__ == "__main__":
    main()
