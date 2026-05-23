/*
 * ESR Tank Management System — IoT Device Firmware
 * Platform : ESP32 DevKit V1 + SIM800L (or SIM7600 for 4G)
 * SIM Card : Airtel India (airtelgprs.com)
 * Libraries : TinyGSM, ArduinoJson (install via Arduino Library Manager)
 *
 * ──────────────────────────────────────────────────────────────
 * WIRING DIAGRAM
 * ──────────────────────────────────────────────────────────────
 *
 *  ESP32 DevKit          SIM800L Module
 *  ────────────          ──────────────
 *  GPIO 16 (RX2) ──────► TX
 *  GPIO 17 (TX2) ◄────── RX
 *  GPIO  5       ──────► PWR_KEY (active LOW pulse 1s)
 *  GND           ──────► GND
 *  [External 4.0V 2A] ── VCC  (separate supply — NOT ESP32 3.3V)
 *
 *  IMPORTANT — Power Supply:
 *  SIM800L draws up to 2A during GSM TX burst.
 *  Use a buck converter set to exactly 4.0V from a 12V adapter.
 *  Add a 1000µF / 10V capacitor across SIM800L VCC–GND.
 *  Insufficient power is the #1 cause of Airtel connection failures.
 *
 *  ESP32 DevKit          YF-S201 Flow Sensor
 *  ────────────          ───────────────────
 *  3.3V          ──────► VCC (use 3.3V level for ESP32 GPIO safety)
 *  GND           ──────► GND
 *  GPIO 34 (IN)  ◄────── Signal  ← input-only pin, interrupt capable
 *
 *  For SIM7600 (4G) replace:
 *    #define TINY_GSM_MODEM_SIM800  →  #define TINY_GSM_MODEM_SIM7600
 *    GSM_BAUD: change to 115200
 *
 * ──────────────────────────────────────────────────────────────
 * AIRTEL APN SETTINGS (India)
 * ──────────────────────────────────────────────────────────────
 *  APN      : airtelgprs.com
 *  Username : (blank)
 *  Password : (blank)
 *  Ensure Airtel SIM has active data plan.
 *  Airtel 2G must be available in your area.
 *
 * ──────────────────────────────────────────────────────────────
 * LIBRARY INSTALLATION (Arduino IDE)
 * ──────────────────────────────────────────────────────────────
 *  Tools → Manage Libraries:
 *    - TinyGSM          by Volodymyr Shymanskyy
 *    - ArduinoJson      by Benoit Blanchon
 * ──────────────────────────────────────────────────────────────
 */

#define TINY_GSM_MODEM_SIM800      // Change to SIM7600 for 4G LTE
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <ArduinoJson.h>

// ─── Device Configuration ─────────────────────────────────────────────────────
#define DEVICE_ID         "DEV001"
#define IOT_SECRET        "your_iot_device_shared_secret_key_change_in_production"
#define SERVER_HOST       "your-server-ip-or-domain.com"
#define SERVER_PORT       5000
#define API_PATH          "/api/iot/data"

// ─── Airtel SIM Configuration ─────────────────────────────────────────────────
#define GSM_APN           "airtelgprs.com"  // Airtel India APN
#define GSM_USER          ""                // Airtel: leave blank
#define GSM_PASS          ""                // Airtel: leave blank

// ─── Hardware Pins ────────────────────────────────────────────────────────────
#define GSM_RX_PIN        16
#define GSM_TX_PIN        17
#define GSM_PWRKEY_PIN    5
#define GSM_BAUD          9600          // SIM7600: use 115200
#define FLOW_SENSOR_PIN   34            // GPIO34 = input-only, interrupt capable
#define LED_PIN           2             // Onboard LED

// ─── Timing ───────────────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS  60000UL       // Send every 60 seconds
#define FLOW_WINDOW_MS    1000UL        // Flow rate recalculation window

// ─── Flow Calibration ─────────────────────────────────────────────────────────
#define PULSES_PER_LITER  450.0f        // YF-S201
#define LITERS_PER_PULSE  (1.0f / PULSES_PER_LITER)

// ─── GSM Objects ──────────────────────────────────────────────────────────────
HardwareSerial SerialGSM(1);            // UART1 on ESP32
TinyGsm        modem(SerialGSM);
TinyGsmClient  gsmClient(modem);

// ─── Globals ──────────────────────────────────────────────────────────────────
volatile uint32_t pulseCount      = 0;
float    flowRate                 = 0.0f;
float    totalizer                = 0.0f;
uint32_t lastFlowCalcTime         = 0;
uint32_t lastSendTime             = 0;
uint32_t lastNetworkCheckTime     = 0;
uint8_t  lastResetHour            = 255;
bool     gprsConnected            = false;

// ─── IRAM ISR: Flow sensor pulse ─────────────────────────────────────────────
void IRAM_ATTR flowPulseISR() {
  pulseCount++;
}

// ═══════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(GSM_PWRKEY_PIN, OUTPUT);
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), flowPulseISR, FALLING);

  Serial.println("\n=== ESR IoT Device (ESP32) ===");
  Serial.printf("Device ID : %s\n", DEVICE_ID);
  Serial.printf("Server    : %s:%d\n", SERVER_HOST, SERVER_PORT);

  // Start GSM serial
  SerialGSM.begin(GSM_BAUD, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);

  gsmPowerOn();
  initModem();
  connectGPRS();
}

// ═══════════════════════════════════════════════════════════════════════════════
void loop() {
  uint32_t now = millis();

  // ── 1. Flow rate calculation (every 1 second) ────────────────────────────────
  if (now - lastFlowCalcTime >= FLOW_WINDOW_MS) {
    noInterrupts();
    uint32_t pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    flowRate   = ((float)pulses * 60.0f) / PULSES_PER_LITER;
    totalizer += (float)pulses * LITERS_PER_PULSE;
    lastFlowCalcTime = now;
  }

  // ── 2. Midnight totalizer reset ─────────────────────────────────────────────
  checkMidnightReset();

  // ── 3. Periodic Airtel keep-alive check (every 5 min) ──────────────────────
  if (now - lastNetworkCheckTime >= 300000UL) {
    lastNetworkCheckTime = now;
    int csq = modem.getSignalQuality();
    Serial.printf("[NET] Signal: %d | GPRS: %s\n",
      csq, modem.isGprsConnected() ? "OK" : "LOST");
    if (!modem.isNetworkConnected() || !modem.isGprsConnected()) {
      Serial.println("[NET] Airtel connection lost — reconnecting...");
      gprsConnected = false;
      connectGPRS();
    }
  }

  // ── 4. Send data every 60 seconds ───────────────────────────────────────────
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
    digitalWrite(LED_PIN, HIGH);

    if (!gprsConnected) connectGPRS();

    if (gprsConnected) {
      bool ok = sendData(flowRate, totalizer);
      if (!ok) {
        Serial.println("[SEND] Failed — forcing reconnect");
        gprsConnected = false;
      }
    }

    digitalWrite(LED_PIN, LOW);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GSM / GPRS Initialisation
// ═══════════════════════════════════════════════════════════════════════════════

void gsmPowerOn() {
  Serial.println("[GSM] Powering on...");
  digitalWrite(GSM_PWRKEY_PIN, LOW);
  delay(1100);
  digitalWrite(GSM_PWRKEY_PIN, HIGH);
  delay(3000);
}

void initModem() {
  Serial.println("[GSM] Initialising modem for Airtel...");

  // Step 1: Confirm module is alive (5 retries)
  bool alive = false;
  for (int i = 0; i < 5; i++) {
    if (modem.testAT(1000)) { alive = true; break; }
    Serial.print('.');
    delay(1000);
  }
  if (!alive) {
    Serial.println("\n[GSM] Modem not responding — check power and wiring");
    return;
  }
  Serial.println();

  modem.sendAT(GF("E0"));    // Echo off
  modem.waitResponse();
  modem.sendAT(GF("+CMEE=2")); // Verbose errors
  modem.waitResponse();

  String modemInfo = modem.getModemInfo();
  Serial.printf("[GSM] Modem: %s\n", modemInfo.c_str());

  // Step 2: Check SIM card
  String simStatus = modem.getSimStatus() == 1 ? "READY" : "NOT READY";
  Serial.printf("[GSM] SIM: %s\n", simStatus.c_str());
  if (modem.getSimStatus() != 1) {
    Serial.println("[GSM] SIM not ready — insert Airtel SIM and restart");
    return;
  }

  // Step 3: Signal quality (0–9 poor, 10–19 fair, 20–31 good, 99 = no signal)
  int csq = modem.getSignalQuality();
  Serial.printf("[GSM] Signal (CSQ): %d", csq);
  if (csq == 99 || csq == 0) Serial.print(" ← No signal! Check antenna.");
  Serial.println();

  // Step 4: Force automatic operator selection (lets module pick Airtel)
  modem.sendAT(GF("+COPS=0"));
  modem.waitResponse(10000L);

  // Step 5: Wait for Airtel network registration (max 60s)
  Serial.print("[GSM] Registering on Airtel");
  if (!modem.waitForNetwork(60000L)) {
    Serial.println(" FAILED");
    Serial.println("      Check: Airtel 2G available in your area? SIM active?");
    return;
  }
  Serial.println(" OK");

  // Show registered operator
  String oper = modem.getOperator();
  Serial.printf("[GSM] Operator: %s\n", oper.c_str());
}

void connectGPRS() {
  Serial.printf("[GPRS] Connecting to Airtel APN: %s\n", GSM_APN);

  // Disconnect first for clean state (Airtel can get stuck)
  modem.gprsDisconnect();
  delay(1000);

  if (!modem.gprsConnect(GSM_APN, GSM_USER, GSM_PASS)) {
    Serial.println("[GPRS] Failed — check APN = airtelgprs.com and data plan");
    gprsConnected = false;
    return;
  }

  String ip = modem.localIP().toString();
  Serial.printf("[GPRS] Connected — IP: %s\n", ip.c_str());

  // Reject phantom connections (0.0.0.0 = GPRS not actually active)
  if (ip == "0.0.0.0") {
    Serial.println("[GPRS] IP is 0.0.0.0 — Airtel GPRS not active. Check data plan.");
    modem.gprsDisconnect();
    gprsConnected = false;
    return;
  }

  gprsConnected = true;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Data Transmission — raw HTTP/1.1 POST over TCP
// ═══════════════════════════════════════════════════════════════════════════════

bool sendData(float flow, float total) {
  // Build JSON payload using ArduinoJson
  StaticJsonDocument<200> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["flowRate"]  = serialized(String(flow,  2));
  doc["totalizer"] = serialized(String(total, 2));

  char payload[200];
  serializeJson(doc, payload, sizeof(payload));
  int bodyLen = strlen(payload);

  Serial.printf("[SEND] %s\n", payload);

  // Open TCP connection
  if (!gsmClient.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[TCP] Connection failed");
    return false;
  }

  // Send raw HTTP/1.1 POST request
  gsmClient.printf("POST %s HTTP/1.1\r\n",      API_PATH);
  gsmClient.printf("Host: %s:%d\r\n",            SERVER_HOST, SERVER_PORT);
  gsmClient.print ("Content-Type: application/json\r\n");
  gsmClient.printf("X-Device-Secret: %s\r\n",    IOT_SECRET);
  gsmClient.printf("Content-Length: %d\r\n",     bodyLen);
  gsmClient.print ("Connection: close\r\n");
  gsmClient.print ("\r\n");
  gsmClient.print (payload);

  // Read HTTP status line
  String statusLine = "";
  uint32_t timeout = millis() + 10000;
  while (millis() < timeout) {
    while (gsmClient.available()) {
      char c = gsmClient.read();
      if (c == '\n') goto done;
      if (c >= ' ')  statusLine += c;
    }
    delay(10);
  }

  done:
  gsmClient.stop();

  Serial.printf("[SEND] Response: %s\n", statusLine.c_str());

  // HTTP/1.1 200 OK or 201 Created
  return (statusLine.indexOf("200") >= 0 || statusLine.indexOf("201") >= 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Midnight Totalizer Reset (using GSM network time)
// ═══════════════════════════════════════════════════════════════════════════════

void checkMidnightReset() {
  static uint32_t lastCheck = 0;
  if (millis() - lastCheck < 55000UL) return;   // Check once per ~minute
  lastCheck = millis();

  int year, month, day, hour, minute, second;
  float timezone;

  if (modem.getNetworkTime(&year, &month, &day, &hour, &minute, &second, &timezone)) {
    if (hour == 0 && lastResetHour != 0) {
      totalizer = 0.0f;
      Serial.println("[RESET] Midnight — totalizer reset to 0.00");
    }
    lastResetHour = hour;
  }
}
