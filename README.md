# ESR Tank Management System

*A smart way to watch over water tanks — from anywhere, in real time.*

---

## 1. Project Overview

**ESR Tank Management** (ESR stands for **Elevated Service Reservoir** — the large water tanks you see on towers in towns and cities) is a complete system that lets water utility staff **monitor water tanks remotely**, without having to physically visit each one.

Small electronic devices are fitted to each tank. These devices measure how much water is flowing in or out, and how full the tank is, then send that information over the mobile network to a central system. Staff can then check the status of every tank — from a computer or a phone — in real time.

The project has three connected parts:

| Part | What it is |
|---|---|
| **Server (Backend)** | The "brain" that receives data from tanks, stores it, and shares it with the apps |
| **Web Dashboard (Client)** | A website for office staff to monitor and manage all tanks |
| **Mobile App** | A phone app so field/control-room staff can check tanks on the move |

Plus a **Hardware/Device** component — the physical electronics that sit on or near each tank.

---

## 2. What Problem It Solves

Traditionally, checking a water tank means sending someone to physically look at it — is it full? Is it leaking? Is water flowing properly? This is:

- **Slow** — problems (like a tank running dry or overflowing) are discovered late
- **Costly** — requires staff travel time, especially for tanks in remote areas
- **Error-prone** — manual readings and paper logs are easy to lose or misrecord
- **Risky** — tanks in remote villages may not have Wi-Fi or reliable internet at all

ESR solves this by putting a small "reporter" device on each tank that automatically sends live readings over the **mobile (SIM card) network** — the same kind of network your phone uses — so it works even in areas without Wi-Fi or broadband. Office staff instantly see live data on a dashboard, and get notified the moment a tank goes offline or stops reporting.

---

## 3. Who Can Use It

The system is built for **water utilities, municipalities, and infrastructure operators** who manage multiple water tanks across a city, town, or rural region. Two types of user accounts exist:

| Role | Who they are | What they can do |
|---|---|---|
| **Admin** | Utility managers / system administrators | Full control: add/edit/delete tanks, manage user accounts, view all data and reports |
| **Control Room** | Monitoring staff / operators | View-only access: watch live tank status and reports, but cannot add/change tanks or users |

---

## 4. How It Works (Step by Step)

1. **A sensor device is installed on the tank.** It has a flow sensor (measures water passing through a pipe) and a level sensor (measures how full the tank is).
2. **The device connects using a mobile SIM card**, not Wi-Fi — so it works even at remote sites with no internet connection.
3. **Every 60 seconds**, the device sends its readings (flow rate, total water used, tank fill %) to the central server over the mobile network.
4. **The server receives and stores this data**, and instantly pushes it out to any dashboard or app that's currently open — this is why the numbers on screen update live, without refreshing the page.
5. **If a tank stops sending data for 5 minutes or more**, the system automatically marks it "Offline" and alerts connected dashboards.
6. **Staff log into the web dashboard or mobile app** to view tank status, drill into details, and check historical reports (daily, weekly, monthly).
7. **Admins can register new tanks, edit tank details, and manage which staff have access.**
8. **As a backup**, if a device can't reach the internet, it can send an SMS text message directly (using its own SIM card) — so critical alerts still get through even without the server.

---

## 5. Main Features

- 📊 **Live Dashboard** — see all tanks at a glance: how many are online, offline, and their total water usage
- 🚰 **Per-Tank Live Monitoring** — real-time flow rate, water level %, and cumulative usage for each tank
- 📈 **Reports** — daily, weekly, and monthly usage summaries with charts, exportable to Excel and PDF
- 🗂️ **Tank Management** — add, edit, remove, and search tanks (Admin only)
- 👥 **User Management** — control who can log in and what they can do (Admin only)
- 🔔 **Automatic Offline Detection** — the system flags a tank the moment it stops reporting
- 📱 **Mobile App** — a phone-friendly version of the dashboard for on-the-go monitoring
- 🔐 **Role-Based Access** — Admins and Control Room staff see different, appropriately-limited views
- 📤 **Data Export** — download tank data and reports as CSV, Excel, or PDF files
- 📡 **Works Without Wi-Fi** — hardware uses mobile SIM cards, ideal for remote tank locations

---

## 6. User Workflow

**Typical day for a Control Room operator:**

1. Open the web dashboard or mobile app and log in
2. Land on the **Live Monitor** screen — a list of all tanks with color-coded online/offline status
3. Spot a tank flagged **offline** or with unusual readings
4. Tap into that tank's **Detail** page to see live flow rate, water level, and a 24-hour trend chart
5. Check the **Reports** section to review that tank's usage pattern over the past day/week/month
6. Export a report if needed for record-keeping or sharing with management

**Typical day for an Admin:**

1. Log in and land on the main **Dashboard** — summary stats and charts for the whole tank network
2. Register a **new tank** when one is installed, entering its name, unique device ID, and location
3. Review the **raw device data table** if investigating a specific reading or sensor issue
4. Manage **user accounts** — add new staff, assign them Admin or Control Room roles, deactivate former staff
5. Everything a Control Room user can also do (monitor, view reports)

---

## 7. Dashboard Explanation

The **web dashboard** (for computers) and **mobile app** (for phones) both show the same core information, styled for their device:

| Screen | What it shows |
|---|---|
| **Login** | Secure sign-in; sends Admins and Control Room users to different home screens |
| **Dashboard** *(Admin)* | Total tanks, how many are online/offline, total water usage, a bar chart comparing tanks, and a pie chart of tank status |
| **Live Monitor** | A card for every tank showing flow rate, fill level, and online/offline badge — refreshes automatically every 30 seconds |
| **Tank Detail** | Deep-dive into one tank: live numbers plus a real-time 24-hour chart of flow rate and total usage |
| **Reports (Daily/Weekly/Monthly)** | Pick a tank and a time period to see totals, averages, highs/lows, and a downloadable report |
| **Tank Management** *(Admin)* | A searchable list of all tanks, with buttons to add, edit, or remove one |
| **User Management** *(Admin)* | A list of staff accounts with their role, and controls to add/edit/remove users |
| **Raw Data / Master** *(Admin)* | The unprocessed sensor readings as they arrive from devices — useful for troubleshooting |
| **Profile** | View your account details and change your password |

All charts and status badges use simple colors and icons (green = online, red/gray = offline) so the status of the whole tank network is understandable at a glance, even without technical knowledge.

---

## 8. Hardware Explanation

Each tank has a small electronics kit attached to it:

| Part | Plain-English Role |
|---|---|
| **Flow Sensor** | A small spinning wheel inside the pipe that counts how much water passes through — like a car's odometer, but for water |
| **Level Sensor ("Level Transmitter")** | Measures how full the tank is, as a percentage (0–100%) |
| **Microcontroller** (a tiny onboard computer — Arduino or ESP32) | Reads the sensors and packages the data to send out |
| **GSM/Cellular Modem** | A modem that uses a regular mobile SIM card (like the ones in phones) to connect to the internet — this means the device works in remote areas that only have cell coverage, not Wi-Fi |

**How it communicates:**
- Every **60 seconds**, the device sends its readings to the server over the mobile network
- If the internet connection fails repeatedly, the device can send a **text message (SMS)** directly to a configured phone number as a backup alert — so problems are never silently missed, even without the internet

A **simulator tool** also exists for testing — it pretends to be multiple real devices, so the system can be tested and demonstrated without needing physical hardware installed.

---

## 9. Benefits

- ✅ **No more manual site visits** just to check water levels
- ✅ **Faster problem detection** — offline tanks or unusual readings are flagged automatically
- ✅ **Works anywhere** — mobile SIM connectivity means no dependency on local Wi-Fi/broadband
- ✅ **Data-driven decisions** — historical reports help plan maintenance and understand usage trends
- ✅ **Reduced water waste** — leaks or overflows can be spotted quickly from flow data
- ✅ **Accountability** — role-based access keeps tank management actions traceable to specific staff
- ✅ **Backup alerting** — SMS fallback means alerts get through even if the internet is down
- ✅ **Accessible from anywhere** — web dashboard for the office, mobile app for the field

---

## 10. Real-Life Use Case

> A municipal water department manages 40 elevated water tanks spread across a city and its surrounding villages, some with no reliable internet. Each tank has a small SIM-based monitoring device installed.
>
> One morning, a tank in a remote village stops sending data. Within 5 minutes, the system marks it "Offline" and the Control Room operator sees it flagged red on the Live Monitor screen. They check the tank's recent history, see the flow rate had dropped to zero an hour before it went silent, and dispatch a technician — catching a possible pump failure before it turns into a multi-day water outage for that village.
>
> Meanwhile, the Admin reviews the Monthly Report and notices that one tank consistently uses more water at night than expected, hinting at a possible leak — an insight that would have taken weeks to notice with manual readings.

---

## 11. Frequently Asked Questions (FAQ)

**Q: Do I need Wi-Fi at the tank location?**
No. The hardware uses a mobile SIM card, so it works anywhere with cellular signal.

**Q: How often is the data updated?**
Devices send new readings every 60 seconds, and the dashboard updates live as soon as new data arrives — no need to refresh the page.

**Q: What happens if a tank's device loses connection?**
The system detects this within about 5 minutes and marks the tank "Offline" on all dashboards. The device may also send a direct SMS alert as backup.

**Q: Can everyone add or delete tanks?**
No. Only **Admin** users can add, edit, or delete tanks and manage user accounts. **Control Room** users can only view live data and reports.

**Q: Can I download reports for record-keeping?**
Yes, reports and data tables can be exported as Excel, CSV, or PDF files.

**Q: Is there a mobile app?**
Yes — a companion mobile app provides the same monitoring features, optimized for phones.

**Q: What is a "totalizer"?**
It's the running total of water that has passed through a tank's pipe over time, similar to an odometer reading for water usage.

**Q: Does the mobile app send push notifications?**
Not currently — alerts are shown as in-app messages while the app is open. Push notifications could be a future enhancement (see below).

---

## 12. Future Improvements

- 🔔 **Push notifications** on the mobile app for instant offline/alert warnings, even when the app is closed
- 🗺️ **Map view** showing tank locations geographically instead of as plain text
- 📩 **Server-triggered SMS/email alerts** for critical events (currently, SMS is only sent directly by the hardware device)
- 📶 **Live notification center** on the web dashboard (currently uses placeholder sample data)
- 🔧 **Predictive maintenance** — using historical data to predict pump or sensor failures before they happen
- 🌐 **Multi-language support** for wider regional use
- 📈 **Advanced analytics** — leak detection, usage forecasting, and anomaly alerts

---

## 13. Conclusion

ESR Tank Management turns water tank monitoring from a manual, delayed, and error-prone process into an **automatic, real-time, and data-driven** one. By combining low-cost sensor hardware, mobile-network connectivity, and easy-to-use web and mobile dashboards, it gives water utilities the visibility they need to prevent shortages, reduce waste, and respond to problems faster — even in the most remote locations.

---

*This README was generated by analyzing the project's source code, configuration, and documentation to describe the system in plain, non-technical language.*
