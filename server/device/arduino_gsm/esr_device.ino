/*
 * ESR Tank Management System — IoT Device Firmware
 * Platform : Arduino Mega 2560 + SIM800L
 * SIM Card : Airtel India (airtelgprs.com)
 * Sensor   : YF-S201 Hall-effect flow sensor (or any pulse-output sensor)
 *
 * ──────────────────────────────────────────────────────────────
 * WIRING DIAGRAM
 * ──────────────────────────────────────────────────────────────
 *
 *  Arduino Mega          SIM800L Module
 *  ─────────────         ──────────────
 *  Pin 10 (RX)  ──────►  TX
 *  Pin 11 (TX)  ◄──────  RX
 *  Pin  9       ──────►  PWR_KEY (pulse LOW 1s to power on/off)
 *  GND          ──────►  GND
 *  [External 4.0V 2A] ►  VCC  (DO NOT use Arduino 5V — SIM800L needs ~2A peak)
 *
 *  IMPORTANT — Power Supply:
 *  SIM800L draws up to 2A during GSM TX burst.
 *  Use a buck converter set to exactly 4.0V from a 12V adapter.
 *  Add a 1000µF / 10V capacitor across VCC–GND on SIM800L.
 *  Insufficient power is the #1 cause of Airtel connection failures.
 *
 *  Arduino Mega          YF-S201 Flow Sensor
 *  ─────────────         ───────────────────
 *  5V           ──────►  VCC (Red)
 *  GND          ──────►  GND (Black)
 *  Pin 2 (INT0) ◄──────  Signal (Yellow)  ← interrupt pin required
 *
 * ──────────────────────────────────────────────────────────────
 * AIRTEL APN SETTINGS (India)
 * ──────────────────────────────────────────────────────────────
 *  APN      : airtelgprs.com
 *  Username : (blank)
 *  Password : (blank)
 *  Ensure Airtel SIM has active data plan.
 *  Airtel 2G must be available in your area.
 *  To check: insert SIM in phone → mobile data ON → can you browse?
 *
 * ──────────────────────────────────────────────────────────────
 * FLOW SENSOR CALIBRATION
 * ──────────────────────────────────────────────────────────────
 *  YF-S201  : ~7.5 pulses/sec = 1 L/min  →  450 pulses per liter
 *  YF-DN50  : ~1.25 pulses/sec = 1 L/min →  75 pulses per liter
 *  Adjust PULSES_PER_LITER for your specific sensor.
 * ──────────────────────────────────────────────────────────────
 */

#include <SoftwareSerial.h>
#include <avr/wdt.h>

// ─── Device Configuration ─────────────────────────────────────────────────────
#define DEVICE_ID         "DEV001"
#define IOT_SECRET        "your_iot_device_shared_secret_key_change_in_production"
#define SERVER_HOST       "your-server-ip-or-domain.com"  // No http://
#define SERVER_PORT       5000
#define API_PATH          "/api/iot/data"

// ─── Airtel SIM Configuration ─────────────────────────────────────────────────
#define GSM_APN           "airtelgprs.com"  // Airtel India APN
#define GSM_USER          ""                // Airtel: leave blank
#define GSM_PASS          ""                // Airtel: leave blank

// ─── Pins ─────────────────────────────────────────────────────────────────────
#define GSM_RX_PIN        10
#define GSM_TX_PIN        11
#define GSM_PWRKEY_PIN    9
#define FLOW_SENSOR_PIN   2            // Must be interrupt pin (2 or 3 on Mega)
#define LED_PIN           13

// ─── Timing ───────────────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS  60000UL      // Send every 60 seconds
#define FLOW_WINDOW_MS    1000UL       // Flow rate calculation window

// ─── Flow Calibration ─────────────────────────────────────────────────────────
#define PULSES_PER_LITER  450.0        // YF-S201: 7.5 pulse/sec × 60 = 450/L
#define LITERS_PER_PULSE  (1.0 / PULSES_PER_LITER)

// ─── AT Command Timeouts ──────────────────────────────────────────────────────
#define AT_SHORT          3000UL
#define AT_MEDIUM         10000UL
#define AT_LONG           30000UL
#define AT_HTTP_WAIT      20000UL

// ─── Globals ──────────────────────────────────────────────────────────────────
SoftwareSerial gsmSerial(GSM_RX_PIN, GSM_TX_PIN);

volatile uint32_t pulseCount    = 0;
float    flowRate               = 0.0;   // L/min
float    totalizer              = 0.0;   // Liters accumulated today
uint32_t lastFlowCalcTime       = 0;
uint32_t lastSendTime           = 0;
uint8_t  lastResetHour          = 255;
bool     gsmReady               = false;

// ─── ISR: Count flow pulses ───────────────────────────────────────────────────
void flowPulseISR() {
  pulseCount++;
}

// ═══════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(9600);
  gsmSerial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  pinMode(GSM_PWRKEY_PIN, OUTPUT);
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), flowPulseISR, FALLING);

  Serial.println(F("=== ESR IoT Device Boot ==="));
  Serial.print(F("Device ID : ")); Serial.println(F(DEVICE_ID));
  Serial.print(F("Server    : ")); Serial.println(F(SERVER_HOST));

  gsmPowerOn();
  gsmReady = initGSM();

  wdt_enable(WDTO_8S);   // Hardware watchdog — resets device if stuck > 8s
}

// ═══════════════════════════════════════════════════════════════════════════════
void loop() {
  wdt_reset();
  uint32_t now = millis();

  // ── 1. Calculate flow rate every 1 second ───────────────────────────────────
  if (now - lastFlowCalcTime >= FLOW_WINDOW_MS) {
    noInterrupts();
    uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    // flowRate (L/min) = (pulses in 1 sec × 60) / pulses-per-liter
    flowRate   = ((float)pulses * 60.0) / PULSES_PER_LITER;
    totalizer += (float)pulses * LITERS_PER_PULSE;

    lastFlowCalcTime = now;
  }

  // ── 2. Midnight totalizer reset ─────────────────────────────────────────────
  checkMidnightReset();

  // ── 3. Send data every 60 seconds ───────────────────────────────────────────
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    digitalWrite(LED_PIN, HIGH);

    if (!gsmReady) {
      Serial.println(F("[GSM] Not ready, reinitialising..."));
      gsmReady = initGSM();
    }

    if (gsmReady) {
      bool ok = sendData(flowRate, totalizer);
      if (!ok) {
        Serial.println(F("[SEND] Failed — will retry next cycle"));
        gsmReady = false;
      }
    }

    digitalWrite(LED_PIN, LOW);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GSM Functions
// ═══════════════════════════════════════════════════════════════════════════════

void gsmPowerOn() {
  Serial.println(F("[GSM] Powering on..."));
  digitalWrite(GSM_PWRKEY_PIN, HIGH);
  delay(100);
  digitalWrite(GSM_PWRKEY_PIN, LOW);
  delay(1100);   // Pulse PWR_KEY LOW for 1 second
  digitalWrite(GSM_PWRKEY_PIN, HIGH);
  delay(3000);   // Wait for module to boot
}

bool initGSM() {
  Serial.println(F("[GSM] Initialising for Airtel..."));
  wdt_reset();

  // ── Step 1: Confirm module is alive ─────────────────────────────────────────
  // Try up to 5 times — SIM800L may still be booting
  bool moduleAlive = false;
  for (int i = 0; i < 5; i++) {
    wdt_reset();
    if (sendAT("AT", "OK", AT_SHORT)) { moduleAlive = true; break; }
    Serial.print('.');
    delay(1000);
  }
  if (!moduleAlive) {
    Serial.println(F("[GSM] Module not responding — check power and wiring"));
    return false;
  }

  sendAT("ATE0",     "OK", AT_SHORT);   // Echo off
  sendAT("AT+CMEE=2","OK", AT_SHORT);   // Verbose error reporting

  // ── Step 2: Check SIM card is inserted and unlocked ─────────────────────────
  if (!waitForResponse("AT+CPIN?", "+CPIN: READY", AT_MEDIUM)) {
    Serial.println(F("[GSM] SIM not ready — check SIM is inserted properly"));
    return false;
  }
  Serial.println(F("[GSM] SIM OK"));

  // ── Step 3: Check signal strength (AT+CSQ) ──────────────────────────────────
  // CSQ: 0–9 = poor, 10–14 = fair, 15–19 = good, 20–31 = excellent
  // 99 = no signal
  gsmSerial.println("AT+CSQ");
  delay(500);
  String csqResp = "";
  while (gsmSerial.available()) csqResp += (char)gsmSerial.read();
  Serial.print(F("[GSM] Signal: ")); Serial.println(csqResp);

  if (csqResp.indexOf("+CSQ: 99") >= 0 || csqResp.indexOf("+CSQ: 0") >= 0) {
    Serial.println(F("[GSM] No Airtel signal — check antenna and 2G coverage"));
    // Continue anyway — signal can improve
  }

  // ── Step 4: Force automatic operator selection (picks Airtel) ───────────────
  sendAT("AT+COPS=0", "OK", AT_MEDIUM);

  // ── Step 5: Wait for Airtel network registration ─────────────────────────────
  Serial.print(F("[GSM] Registering on Airtel"));
  bool registered = false;
  for (int i = 0; i < 60; i++) {      // Wait up to 60 seconds
    wdt_reset();
    if (isNetworkRegistered()) {
      registered = true;
      Serial.println(F(" OK"));
      break;
    }
    Serial.print('.');
    delay(1000);
  }
  if (!registered) {
    Serial.println(F("\n[GSM] Network registration failed"));
    Serial.println(F("      Check: Airtel 2G in your area? SIM active?"));
    return false;
  }

  // Show which operator we registered on
  gsmSerial.println("AT+COPS?");
  delay(500);
  String opsResp = "";
  while (gsmSerial.available()) opsResp += (char)gsmSerial.read();
  Serial.print(F("[GSM] Operator: ")); Serial.println(opsResp);

  // ── Step 6: Set PDP context with Airtel APN ──────────────────────────────────
  // This is required before opening the HTTP bearer on some Airtel SIMs
  sendAT("AT+CGDCONT=1,\"IP\",\"" GSM_APN "\"", "OK", AT_SHORT);

  // Detach then re-attach GPRS for a clean state
  sendAT("AT+CGATT=0", "OK", AT_MEDIUM);
  delay(1000);
  wdt_reset();
  sendAT("AT+CGATT=1", "OK", AT_MEDIUM);
  delay(1000);
  wdt_reset();

  // ── Step 7: Configure SAPBR bearer (used by AT+HTTP commands) ───────────────
  // Always close first to avoid "already open" errors
  sendAT("AT+SAPBR=0,1", "OK", AT_MEDIUM);
  delay(1000);

  sendAT("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"", "OK", AT_SHORT);
  sendGSMParam("AT+SAPBR=3,1,\"APN\",\"", GSM_APN, "\"");
  // Airtel username/password are blank — skip if empty

  // ── Step 8: Open bearer ──────────────────────────────────────────────────────
  wdt_reset();
  Serial.println(F("[GSM] Opening Airtel GPRS bearer..."));
  if (!sendAT("AT+SAPBR=1,1", "OK", AT_LONG)) {
    Serial.println(F("[GSM] Bearer open failed — retrying in 5s"));
    delay(5000);
    wdt_reset();
    if (!sendAT("AT+SAPBR=1,1", "OK", AT_LONG)) {
      Serial.println(F("[GSM] Bearer failed. Check APN = airtelgprs.com"));
      return false;
    }
  }

  // ── Step 9: Confirm IP address was assigned ───────────────────────────────────
  gsmSerial.println("AT+SAPBR=2,1");
  delay(500);
  String ipResp = "";
  while (gsmSerial.available()) ipResp += (char)gsmSerial.read();
  Serial.print(F("[GSM] Airtel IP: ")); Serial.println(ipResp);

  if (ipResp.indexOf("0.0.0.0") >= 0) {
    Serial.println(F("[GSM] IP is 0.0.0.0 — GPRS not active. Check data plan."));
    return false;
  }

  Serial.println(F("[GSM] Airtel GPRS ready!"));
  return true;
}

// ─── Send one IoT data payload via HTTP POST ──────────────────────────────────
bool sendData(float flow, float total) {
  Serial.print(F("[SEND] flowRate="));
  Serial.print(flow, 2);
  Serial.print(F(" totalizer="));
  Serial.println(total, 2);
  wdt_reset();

  // Build JSON payload
  char body[128];
  dtostrf(flow,  1, 2, body);  // temp buffer
  char flowStr[12]; strcpy(flowStr, body);
  dtostrf(total, 1, 2, body);
  char totalStr[12]; strcpy(totalStr, body);

  char payload[160];
  snprintf(payload, sizeof(payload),
    "{\"deviceId\":\"%s\",\"flowRate\":%s,\"totalizer\":%s}",
    DEVICE_ID, flowStr, totalStr
  );

  int bodyLen = strlen(payload);

  // ── HTTP sequence ────────────────────────────────────────────────────────────
  sendAT("AT+HTTPTERM", "OK", AT_SHORT);   // Ensure clean state
  delay(500);

  if (!sendAT("AT+HTTPINIT", "OK", AT_SHORT)) return false;

  sendAT("AT+HTTPPARA=\"CID\",1", "OK", AT_SHORT);

  // Build URL
  char urlCmd[128];
  snprintf(urlCmd, sizeof(urlCmd),
    "AT+HTTPPARA=\"URL\",\"http://%s:%d%s\"",
    SERVER_HOST, SERVER_PORT, API_PATH
  );
  sendAT(urlCmd, "OK", AT_SHORT);

  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", AT_SHORT);

  // Custom header: X-Device-Secret
  char hdrCmd[128];
  snprintf(hdrCmd, sizeof(hdrCmd),
    "AT+HTTPPARA=\"USERDATA\",\"X-Device-Secret: %s\\r\\n\"",
    IOT_SECRET
  );
  sendAT(hdrCmd, "OK", AT_SHORT);

  // Send body
  char dataCmd[32];
  snprintf(dataCmd, sizeof(dataCmd), "AT+HTTPDATA=%d,10000", bodyLen);
  if (!sendAT(dataCmd, "DOWNLOAD", AT_MEDIUM)) {
    sendAT("AT+HTTPTERM", "OK", AT_SHORT);
    return false;
  }

  gsmSerial.print(payload);
  delay(1000);

  // Execute POST
  wdt_reset();
  if (!sendAT("AT+HTTPACTION=1", "+HTTPACTION", AT_HTTP_WAIT)) {
    sendAT("AT+HTTPTERM", "OK", AT_SHORT);
    return false;
  }

  // Parse HTTP status code from +HTTPACTION: 1,<code>,<len>
  String response = readGSMLine(2000);
  sendAT("AT+HTTPTERM", "OK", AT_SHORT);

  if (response.indexOf(",200,") >= 0 || response.indexOf(",201,") >= 0) {
    Serial.println(F("[SEND] OK 200"));
    return true;
  }

  Serial.print(F("[SEND] Unexpected response: "));
  Serial.println(response);
  return false;
}

// ─── Midnight totalizer reset ─────────────────────────────────────────────────
void checkMidnightReset() {
  // Query GSM network time via AT+CCLK?
  // Response format: +CCLK: "26/05/22,00:01:05+22"
  // Only parse hour field and reset once per day

  // This runs every 60s at most — only query at the start of a new hour
  static uint32_t lastHourCheck = 0;
  if (millis() - lastHourCheck < 55000UL) return;
  lastHourCheck = millis();

  gsmSerial.println("AT+CCLK?");
  delay(500);
  String resp = "";
  while (gsmSerial.available()) resp += (char)gsmSerial.read();

  // Parse hour from response: "YY/MM/DD,HH:MM:SS+TZ"
  int cclkIdx = resp.indexOf("+CCLK:");
  if (cclkIdx < 0) return;

  // Extract HH from ",HH:MM:SS"
  int commaIdx = resp.indexOf(',', cclkIdx);
  if (commaIdx < 0) return;

  int hour = resp.substring(commaIdx + 1, commaIdx + 3).toInt();

  if (hour == 0 && lastResetHour != 0) {
    totalizer = 0.0;
    Serial.println(F("[RESET] Midnight — totalizer reset to 0"));
  }
  lastResetHour = hour;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AT Command Helpers
// ═══════════════════════════════════════════════════════════════════════════════

// Send AT command and wait for expected response
bool sendAT(const char* cmd, const char* expected, uint32_t timeout) {
  while (gsmSerial.available()) gsmSerial.read();   // Flush
  gsmSerial.println(cmd);
  Serial.print(F("  AT> ")); Serial.println(cmd);

  uint32_t start = millis();
  String resp = "";
  while (millis() - start < timeout) {
    while (gsmSerial.available()) {
      char c = gsmSerial.read();
      resp += c;
    }
    if (resp.indexOf(expected) >= 0) {
      return true;
    }
    if (resp.indexOf("ERROR") >= 0) {
      Serial.print(F("  AT< ERROR: ")); Serial.println(resp);
      return false;
    }
    wdt_reset();
  }
  Serial.print(F("  AT< TIMEOUT: ")); Serial.println(resp);
  return false;
}

bool waitForResponse(const char* cmd, const char* expected, uint32_t timeout) {
  return sendAT(cmd, expected, timeout);
}

bool isNetworkRegistered() {
  gsmSerial.println("AT+CREG?");
  delay(500);
  String resp = "";
  while (gsmSerial.available()) resp += (char)gsmSerial.read();
  // 0,1 = registered home, 0,5 = registered roaming
  return (resp.indexOf(",1") >= 0 || resp.indexOf(",5") >= 0);
}

void sendGSMParam(const char* prefix, const char* value, const char* suffix) {
  char cmd[100];
  snprintf(cmd, sizeof(cmd), "%s%s%s", prefix, value, suffix);
  sendAT(cmd, "OK", AT_SHORT);
}

String readGSMLine(uint32_t timeout) {
  String line = "";
  uint32_t start = millis();
  while (millis() - start < timeout) {
    while (gsmSerial.available()) {
      char c = gsmSerial.read();
      if (c == '\n') return line;
      if (c >= ' ') line += c;
    }
    wdt_reset();
  }
  return line;
}
