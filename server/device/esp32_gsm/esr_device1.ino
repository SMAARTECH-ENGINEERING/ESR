/*
 * ESR Tank Management System — IoT Device Firmware
 * Platform : ESP32 DevKit V1 + SIM7670G (4G Cat.1)
 * SIM Card : Airtel India (airtelgprs.com)
 * Style    : Raw AT commands over HardwareSerial (no TinyGSM)
 *
 * Features:
 *   1. Random flow + totalizer simulation
 *   2. HTTP POST JSON data to backend every 60 s
 *   3. SMS notification on boot + on send failure threshold
 *
 * ──────────────────────────────────────────────────────────────
 * WIRING
 * ──────────────────────────────────────────────────────────────
 *  ESP32          SIM7670G
 *  ─────          ────────
 *  GPIO 16 (RX) ◄── TX
 *  GPIO 17 (TX) ──► RX
 *  GND          ──► GND
 *  Ext 4.0V 2A  ──► VCC
 * ──────────────────────────────────────────────────────────────
 */
 
#include <HardwareSerial.h>
#include <ArduinoJson.h>
 
// ─── Pins / Serial ────────────────────────────────────────────────────────────
#define GSM_RX 16   // ESP32 RX <- SIM7670 TX
#define GSM_TX 17   // ESP32 TX -> SIM7670 RX
HardwareSerial gsm(1);
 
// ─── Device Config ────────────────────────────────────────────────────────────
#define DEVICE_ID    "DEV001"
#define IOT_SECRET   "your_iot_device_shared_secret_key_change_in_production"
#define SERVER_HOST  "esr-zjwg.onrender.com"
// #define SERVER_PORT  5000
#define API_PATH     "/api/iot/data"
 
// ─── Airtel APN ───────────────────────────────────────────────────────────────
#define GSM_APN      "airtelgprs.com"
 
// ─── SMS Alert Recipient ──────────────────────────────────────────────────────
String alertPhone   = "+917205855966";
 
// ─── Timing ───────────────────────────────────────────────────────────────────
#define SEND_INTERVAL_MS  60000UL    // POST every 60 s
#define FLOW_UPDATE_MS    3000UL     // refresh random flow every 3 s
 
// ─── Random Flow Range (L/min) ────────────────────────────────────────────────
#define MIN_RANDOM_FLOW   5.0f
#define MAX_RANDOM_FLOW   25.0f
 
// ─── Globals ──────────────────────────────────────────────────────────────────
float    flowRate              = 0.0f;
float    totalizer             = 0.0f;
uint32_t lastFlowUpdate        = 0;
uint32_t lastTotalCalc         = 0;
uint32_t lastSendTime          = 0;
uint8_t  failCount             = 0;
bool     bootSmsSent           = false;
bool     netReady              = false;
 
// ═══════════════════════════════════════════════════════════════════════════════
//  AT Helpers (same style as your test code)
// ═══════════════════════════════════════════════════════════════════════════════
void sendAT(String cmd, uint32_t waitTime = 1000) {
  Serial.print(">> "); Serial.println(cmd);
  gsm.println(cmd);
  delay(waitTime);
  while (gsm.available()) Serial.write(gsm.read());
}
 
// Read response into a String — needed for IP / status checks
String sendATResp(String cmd, uint32_t waitTime = 1000) {
  Serial.print(">> "); Serial.println(cmd);
  gsm.println(cmd);
  String resp = "";
  uint32_t start = millis();
  while (millis() - start < waitTime) {
    while (gsm.available()) resp += (char)gsm.read();
  }
  Serial.print(resp);
  return resp;
}
 
bool waitFor(const char *needle, uint32_t timeoutMs) {
  String buf = "";
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    while (gsm.available()) {
      char c = gsm.read();
      buf += c;
      Serial.write(c);
      if (buf.indexOf(needle) != -1) return true;
    }
    delay(5);
  }
  return false;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
//  Random Flow
// ═══════════════════════════════════════════════════════════════════════════════
float generateRandomFlow() {
  long minV = (long)(MIN_RANDOM_FLOW * 10);
  long maxV = (long)(MAX_RANDOM_FLOW * 10);
  return random(minV, maxV + 1) / 10.0f;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
//  Modem Init + Network (SIM7670G specific)
// ═══════════════════════════════════════════════════════════════════════════════
void initModem() {
  Serial.println("\n[GSM] Initialising SIM7670G...");
  sendAT("AT",        1000);
  sendAT("ATE0",      500);
  sendAT("AT+CMEE=2", 500);
  sendAT("AT+CPIN?",  1000);
  sendAT("AT+CSQ",    1000);
  sendAT("AT+CREG?",  1000);
  sendAT("AT+CGREG?", 1000);
  sendAT("AT+COPS?",  2000);
 
  // SMS text mode (do once)
  sendAT("AT+CMGF=1", 500);
  sendAT("AT+CSCS=\"GSM\"", 500);
}
 
bool connectNetwork() {
  Serial.println("[NET] Setting up PDP context for Airtel...");
 
  // Define PDP context for Airtel
  sendAT("AT+CGDCONT=1,\"IP\",\"" + String(GSM_APN) + "\"", 1000);
  sendAT("AT+CGATT=1", 3000);
  sendAT("AT+CGACT=1,1", 5000);
 
  // Check IP
  String r = sendATResp("AT+CGPADDR=1", 2000);
  if (r.indexOf("0.0.0.0") != -1 || r.indexOf("ERROR") != -1) {
    Serial.println("[NET] No IP — Airtel data not active");
    netReady = false;
    return false;
  }
 
  Serial.println("[NET] Online");
  netReady = true;
  return true;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
//  HTTP POST (SIM7670G)
// ═══════════════════════════════════════════════════════════════════════════════
bool sendData(float flow, float total) {
  // Build JSON
  StaticJsonDocument<200> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["flowRate"]  = serialized(String(flow,  2));
  doc["totalizer"] = serialized(String(total, 2));
  char payload[200];
  serializeJson(doc, payload, sizeof(payload));
  int bodyLen = strlen(payload);
 
//   Serial.printf("[SEND] %s\n", payload);
Serial.printf("Server  : %s%s\n", SERVER_HOST, API_PATH);
 
//   String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + String(API_PATH);
String url = "https://" + String(SERVER_HOST) + String(API_PATH);
 
  sendAT("AT+HTTPTERM", 300);                          // clean state
  sendAT("AT+HTTPSSL=1", 1000);
  sendAT("AT+HTTPPARA=\"CID\",1", 500);
  sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", 1000);
  sendAT("AT+HTTPPARA=\"CONNECTTO\",30", 500);
  sendAT("AT+HTTPPARA=\"RECVTO\",30", 500);
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", 500);
  sendAT("AT+HTTPPARA=\"USERDATA\",\"X-Device-Secret: " + String(IOT_SECRET) + "\"", 500);
 
  // POST body upload prompt
  gsm.print("AT+HTTPDATA=");
  gsm.print(bodyLen);
  gsm.println(",10000");
  if (!waitFor("DOWNLOAD", 3000)) {
    Serial.println("\n[HTTP] no DOWNLOAD prompt");
    sendAT("AT+HTTPTERM", 300);
    return false;
  }
 
  gsm.print(payload);
  if (!waitFor("OK", 5000)) {
    Serial.println("\n[HTTP] body not acknowledged");
    sendAT("AT+HTTPTERM", 300);
    return false;
  }
 
  // Trigger POST
  gsm.println("AT+HTTPACTION=1");
 
  // Wait for +HTTPACTION: 1,<status>,<len>
  String resp = "";
  uint32_t start = millis();
  bool ok = false;
  while (millis() - start < 20000) {
    while (gsm.available()) {
      char c = gsm.read();
      resp += c;
      Serial.write(c);
    }
    if (resp.indexOf("+HTTPACTION:") != -1) {
      ok = (resp.indexOf(",200,") != -1 || resp.indexOf(",201,") != -1);
      break;
    }
  }
 
  if (ok) {
    sendAT("AT+HTTPREAD=0,512", 2000);
    Serial.println("[SEND] OK");
  } else {
    Serial.println("[SEND] FAIL");
  }
 
  sendAT("AT+HTTPTERM", 500);
  return ok;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
//  SMS (same pattern as your test code)
// ═══════════════════════════════════════════════════════════════════════════════
bool sendSMS(String number, String message) {
  Serial.println("\n[SMS] Sending to " + number);
 
  sendAT("AT+CMGF=1", 500);
 
  gsm.print("AT+CMGS=\"");
  gsm.print(number);
  gsm.println("\"");
  if (!waitFor(">", 5000)) {
    Serial.println("[SMS] no '>' prompt");
    return false;
  }
 
  gsm.print(message);
  delay(300);
  gsm.write(26);   // CTRL+Z
 
  bool ok = waitFor("+CMGS:", 30000);
  Serial.println(ok ? "\n[SMS] sent" : "\n[SMS] failed");
  return ok;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  gsm.begin(115200, SERIAL_8N1, GSM_RX, GSM_TX);
 
  randomSeed(analogRead(34));
 
  Serial.println("\nStarting SIM7670G IoT Device...");
  Serial.printf("Device  : %s\n", DEVICE_ID);
  Serial.printf("Server  : %s%s\n", SERVER_HOST, API_PATH);
  Serial.printf("Alert # : %s\n", alertPhone.c_str());
  delay(5000);
 
  initModem();
  connectNetwork();
 
  flowRate       = generateRandomFlow();
  lastFlowUpdate = millis();
  lastTotalCalc  = millis();
 
  // Boot SMS — fire & forget
  if (!bootSmsSent) {
    sendSMS(alertPhone, "SEPL " + String(DEVICE_ID) + " ONLINE");
    bootSmsSent = true;
  }
}
 
// ═══════════════════════════════════════════════════════════════════════════════
void loop() {
  uint32_t now = millis();
 
  // 1. Update random flow every few seconds
  if (now - lastFlowUpdate >= FLOW_UPDATE_MS) {
    flowRate = generateRandomFlow();
    lastFlowUpdate = now;
  }
 
  // 2. Totalizer (continuous integration)
  float deltaSec = (now - lastTotalCalc) / 1000.0f;
  lastTotalCalc  = now;
  totalizer     += (flowRate / 60.0f) * deltaSec;   // L/min → L
 
  // 3. Send every 60 s
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;
 
    Serial.printf("\n[DATA] Flow=%.2f L/min | Total=%.2f L\n", flowRate, totalizer);
 
    if (!netReady) connectNetwork();
 
    bool ok = false;
    if (netReady) ok = sendData(flowRate, totalizer);
 
    if (ok) {
      failCount = 0;
    } else {
      failCount++;
      Serial.printf("[SEND] consecutive failures: %d\n", failCount);
      netReady = false;
 
      // SMS alert after 5 consecutive failures
      if (failCount == 5) {
        sendSMS(alertPhone,
                "ALERT: " + String(DEVICE_ID) + " HTTP fail x5. Last total " +
                String(totalizer, 1) + "L");
      }
    }
  }
 
  // Drain any URCs to serial monitor
  while (gsm.available()) Serial.write(gsm.read());
}
 
 