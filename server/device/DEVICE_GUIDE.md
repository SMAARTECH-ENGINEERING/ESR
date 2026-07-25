# ESR IoT Device Integration Guide

Connect any GSM-enabled IoT device to the ESR Tank Management backend.

---

## Supported Platforms

| File | Platform | GSM Module | Best For |
|---|---|---|---|
| `arduino_gsm/esr_device.ino` | Arduino Mega 2560 | SIM800L | Low-cost, basic deployment |
| `esp32_gsm/esr_device.ino` | ESP32 DevKit V1 | SIM800L / SIM7600 | Production-grade |
| `simulator/device_simulator.py` | PC / Raspberry Pi | — | Development & testing |

---

## Hardware Requirements

### Option A — Arduino Mega + SIM800L (Budget)

| Component | Specification | Notes |
|---|---|---|
| Microcontroller | Arduino Mega 2560 | More RAM and Serial ports than Uno |
| GSM Module | SIM800L v2 | 2G GPRS — check local 2G availability |
| Flow Sensor | YF-S201 or DN50 | Hall effect, pulse output |
| Power Supply | 12V DC 2A adapter | Powers Arduino + SIM800L via buck converter |
| Buck Converter | DC-DC step-down to 4.0V/2A | SIM800L needs 3.7–4.2V at 2A peak |
| SIM Card | Any 2G-enabled SIM | Airtel, Jio (2G), BSNL |
| Capacitor | 1000µF / 10V electrolytic | Across SIM800L VCC–GND to stabilize power |

### Option B — ESP32 + SIM800L (Recommended)

| Component | Specification | Notes |
|---|---|---|
| Microcontroller | ESP32 DevKit V1 (38-pin) | 520KB RAM, FreeRTOS, dual-core |
| GSM Module | SIM800L v2 | 2G GPRS |
| Flow Sensor | YF-S201 | Use 3.3V supply, GPIO34 for signal |
| Power | Same as Option A | |

### Option C — ESP32 + SIM7600 (4G LTE)

Replace SIM800L with SIM7600 module and change firmware:
```cpp
// esp32_gsm/esr_device.ino — line 1
#define TINY_GSM_MODEM_SIM7600   // was SIM800
// Also change GSM_BAUD to 115200
```

---

## Wiring Diagrams

### Arduino Mega + SIM800L

```
                    ┌─────────────────────┐
  12V DC ──────────►│  DC-DC Buck         │
                    │  Converter          │
                    │  4.0V / 2A out      │
                    └──────┬──────────────┘
                           │
              4.0V ────────┼────────► SIM800L VCC
              GND  ─────────────────► SIM800L GND
                           │
                    ┌──────┴──────────────────────────────┐
                    │          Arduino Mega 2560           │
                    │                                      │
                    │  5V  ──────────────────────────────► Flow Sensor VCC
                    │  GND ──────────────────────────────► Flow Sensor GND
                    │  Pin 2 (INT0) ◄─────────────────── Flow Sensor Signal
                    │                                      │
                    │  Pin 10 (RX) ──────────────────────► SIM800L TX
                    │  Pin 11 (TX) ◄─────────────────── SIM800L RX
                    │  Pin  9      ──────────────────────► SIM800L PWR_KEY
                    │  GND ──────────────────────────────► SIM800L GND
                    │                                      │
                    │  Pin 13 (LED) ── Status indicator    │
                    └─────────────────────────────────────┘
```

### ESP32 DevKit + SIM800L

```
                    ┌─────────────────────┐
  12V DC ──────────►│  DC-DC Buck 4.0V    │
                    └──────┬──────────────┘
                           │ 4.0V/2A
                    ┌──────┴─────────────────────────────────┐
                    │             ESP32 DevKit V1             │
                    │                                         │
                    │  3.3V ─────────────────────────────────► Flow Sensor VCC
                    │  GND  ─────────────────────────────────► Flow Sensor GND
                    │  GPIO34 (INPUT) ◄───────────────────── Flow Sensor Signal
                    │                                         │
                    │  GPIO16 (RX2) ─────────────────────────► SIM800L TX
                    │  GPIO17 (TX2) ◄─────────────────────── SIM800L RX
                    │  GPIO 5       ─────────────────────────► SIM800L PWR_KEY
                    │  GND          ─────────────────────────► SIM800L GND
                    │  [from buck]  ─────────────────────────► SIM800L VCC (4.0V)
                    │                                         │
                    │  GPIO2 (LED)  ── Status LED             │
                    └─────────────────────────────────────────┘
```

---

## Configuration

### Step 1 — Set device credentials in firmware

Open the `.ino` file and edit the top section:

```cpp
// ─── Device Configuration ─────────────────────────────────────
#define DEVICE_ID     "DEV001"   // Must match deviceId in backend database
#define IOT_SECRET    "your_iot_device_shared_secret_key_change_in_production"
                                  // Must match IOT_DEVICE_SECRET in backend .env
#define SERVER_HOST   "your-server-ip-or-domain.com"
#define SERVER_PORT   5000
#define API_PATH      "/api/iot/data"

// ─── SIM Card APN ─────────────────────────────────────────────
#define GSM_APN   "internet"     // Common APNs:
                                  //   Airtel   → "airtelgprs.com"
                                  //   Jio      → "jionet"
                                  //   BSNL     → "bsnlnet"
                                  //   Vodafone → "www"
```

### Step 2 — Register the tank in the backend

```bash
# Login as admin to get token
curl -X POST http://your-server:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@esr.com","password":"Admin@123456"}'

# Create the tank with the same deviceId
curl -X POST http://your-server:5000/api/tanks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tankName": "Water Tank Zone A",
    "deviceId": "DEV001",
    "location": "Zone A - North End"
  }'
```

### Step 3 — Flash the firmware

**Arduino IDE:**
1. `File → Open → esr_device.ino`
2. `Tools → Board → Arduino Mega 2560` (or ESP32 DevKit)
3. `Tools → Port → COM port of your board`
4. `Sketch → Upload`

**PlatformIO (VS Code):**
```ini
; platformio.ini
[env:megaatmega2560]
platform = atmelavr
board = megaatmega2560
framework = arduino
lib_deps =

[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    vshymanskyy/TinyGSM @ ^0.11.7
    bblanchon/ArduinoJson @ ^6.21.3
```

---

## Data Flow

```
Physical Device
      │
      │  Every 60 seconds
      │  POST /api/iot/data
      │  Header: X-Device-Secret: <secret>
      │
      │  Body:
      │  {
      │    "deviceId":          "DEV001",
      │    "flowRate":          120.50,
      │    "totalizer":         4500.25,
      │    "waterLevelPercent": 75.4
      │  }
      │
      ▼
ESR Backend (Node.js)
      │
      ├── Validates X-Device-Secret
      ├── Validates JSON payload (Joi)
      ├── Finds tank by deviceId
      ├── Saves to live_data (MongoDB, TTL 24h)
      ├── Updates tank.status = "online"
      ├── Updates tank.lastSeen = now
      └── Emits Socket.IO event to dashboard clients
```

---

## Flow Sensor Calibration

The firmware uses a `PULSES_PER_LITER` constant. Measure yours accurately:

```
Measurement procedure:
1. Collect exactly 1 litre of water through the sensor
2. Count the pulses from the Arduino Serial Monitor
3. Set PULSES_PER_LITER = measured count

Common sensors:
  YF-S201 (1/2 inch, 1–30 L/min)  →  ~450 pulses/litre
  YF-S401 (1/4 inch, 0.1–3 L/min) →  ~600 pulses/litre
  DN20 water meter with reed switch →  Depends on meter rating
  DN50 / DN80 industrial meter     →  Check datasheet
```

---

## Finding Your SIM APN

| Provider | Country | APN | Username | Password |
|---|---|---|---|---|
| Airtel | India | airtelgprs.com | — | — |
| Jio | India | jionet | — | — |
| BSNL | India | bsnlnet | — | — |
| Vodafone IN | India | www | — | — |
| Airtel | Bangladesh | internet | — | — |
| GP (Grameenphone) | Bangladesh | internet | — | — |

---

## Serial Monitor Output (expected)

```
=== ESR IoT Device Boot ===
Device ID : DEV001
Server    : your-server.com
[GSM] Powering on...
[GSM] Initialising...
  AT> AT
  AT> ATE0
  AT> AT+CPIN?
[GSM] Waiting for network...... OK
  AT> AT+SAPBR=3,1,"CONTYPE","GPRS"
  AT> AT+SAPBR=3,1,"APN","airtelgprs.com"
  AT> AT+SAPBR=1,1
[GSM] GPRS ready
[SEND] flowRate=118.50 totalizer=1200.40
  AT> AT+HTTPTERM
  AT> AT+HTTPINIT
  ...
  AT> AT+HTTPACTION=1
[SEND] OK 200
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `No response from module` | SIM800L not powered / wiring wrong | Check 4.0V/2A supply, check TX/RX wiring |
| `SIM not ready` | No SIM, wrong SIM slot | Insert 2G-capable SIM card |
| `Network timeout` | No 2G coverage, wrong APN | Check signal, verify APN |
| `GPRS bearer failed` | Wrong APN credentials | Update `GSM_APN` in firmware |
| `HTTP 401 Unauthorized` | Wrong `IOT_SECRET` | Match `IOT_DEVICE_SECRET` in `.env` |
| `HTTP 404 Not Found` | `deviceId` not in database | Register tank via API first |
| `HTTP 400 Bad Request` | Invalid payload | Check JSON format in firmware |
| Totalizer not resetting | GSM time not available | Check AT+CCLK? manually |

---

## Python Simulator (Testing Without Hardware)

```bash
# Install dependency
pip install requests

# Run simulator (sends data every 5 seconds in fast mode)
cd device/simulator
python device_simulator.py
```

Configure devices in `device_simulator.py`:

```python
CONFIG = {
    "base_url":         "http://localhost:5000",
    "iot_secret":       "your_iot_device_shared_secret_key_change_in_production",
    "fast_mode_sec":    5,    # 5s for testing, 60 for production simulation
}

DEVICES = [
    { "device_id": "DEV001", "base_flow": 120.0, "flow_noise": 15.0, "base_level": 75.0, "level_noise": 3.0 },
    { "device_id": "DEV002", "base_flow": 95.0,  "flow_noise": 10.0, "base_level": 60.0, "level_noise": 4.0 },
]
```

---

## HTTPS Support

SIM800L does not support TLS/HTTPS natively. Options:

**Option 1 — Nginx reverse proxy (recommended for production)**
```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    location /api/iot/data {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
}
```
Device connects to port 443 via SIM7600 (which supports TLS).

**Option 2 — Use SIM7600 (4G) module**
SIM7600 supports SSL/TLS natively. Change firmware define:
```cpp
#define TINY_GSM_MODEM_SIM7600
```

**Option 3 — HTTP on private APN (secure network)**
Use a private APN with VPN tunnel — no public SSL needed.
