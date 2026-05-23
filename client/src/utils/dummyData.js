// Central dummy data — used as fallback when API is unavailable

export const DUMMY_TANKS = [
  { _id: 'd1', tankName: 'ESR Tank A1', deviceId: 'DEV001', location: 'Bhubaneswar North', status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 2.45, totalizer: 184200, timestamp: new Date().toISOString() } },
  { _id: 'd2', tankName: 'ESR Tank A2', deviceId: 'DEV002', location: 'Bhubaneswar South', status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 1.87, totalizer: 97650,  timestamp: new Date().toISOString() } },
  { _id: 'd3', tankName: 'ESR Tank B1', deviceId: 'DEV003', location: 'Cuttack East',      status: 'offline', lastSeen: new Date(Date.now() - 18 * 60000).toISOString(), latestData: null },
  { _id: 'd4', tankName: 'ESR Tank B2', deviceId: 'DEV004', location: 'Cuttack West',      status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 3.10, totalizer: 212400, timestamp: new Date().toISOString() } },
  { _id: 'd5', tankName: 'ESR Tank C1', deviceId: 'DEV005', location: 'Puri Main',         status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 0.92, totalizer: 56300,  timestamp: new Date().toISOString() } },
  { _id: 'd6', tankName: 'ESR Tank C2', deviceId: 'DEV006', location: 'Puri Beach Road',   status: 'inactive',lastSeen: null, latestData: null },
  { _id: 'd7', tankName: 'ESR Tank D1', deviceId: 'DEV007', location: 'Sambalpur Zone 1',  status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 4.20, totalizer: 318900, timestamp: new Date().toISOString() } },
  { _id: 'd8', tankName: 'ESR Tank D2', deviceId: 'DEV008', location: 'Sambalpur Zone 2',  status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 1.55, totalizer: 134700, timestamp: new Date().toISOString() } },
  { _id: 'd9', tankName: 'ESR Tank E1', deviceId: 'DEV009', location: 'Berhampur North',   status: 'offline', lastSeen: new Date(Date.now() - 35 * 60000).toISOString(), latestData: null },
  { _id: 'd10',tankName: 'ESR Tank E2', deviceId: 'DEV010', location: 'Berhampur South',   status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 2.78, totalizer: 201500, timestamp: new Date().toISOString() } },
  { _id: 'd11',tankName: 'ESR Tank F1', deviceId: 'DEV011', location: 'Rourkela Sector 4', status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 3.65, totalizer: 276400, timestamp: new Date().toISOString() } },
  { _id: 'd12',tankName: 'ESR Tank F2', deviceId: 'DEV012', location: 'Rourkela Sector 7', status: 'online',  lastSeen: new Date().toISOString(), latestData: { flowRate: 1.20, totalizer: 89200,  timestamp: new Date().toISOString() } },
];

export const DUMMY_SUMMARY = {
  totalTanks: DUMMY_TANKS.length,
  online:     DUMMY_TANKS.filter((t) => t.status === 'online').length,
  offline:    DUMMY_TANKS.filter((t) => t.status === 'offline').length,
  inactive:   DUMMY_TANKS.filter((t) => t.status === 'inactive').length,
};

// Generate 24h of readings (every 5 min = 288 points)
export function generateHistory(baseFlow = 2.5, baseTotalizer = 50000) {
  const points = [];
  const now = Date.now();
  let totalizer = baseTotalizer;
  for (let i = 287; i >= 0; i--) {
    const ts = new Date(now - i * 5 * 60 * 1000);
    const jitter = (Math.random() - 0.5) * 0.8;
    const flowRate = Math.max(0, parseFloat((baseFlow + jitter).toFixed(2)));
    totalizer += flowRate * 5;
    points.push({
      time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      flowRate,
      totalizer: Math.round(totalizer),
      timestamp: ts.getTime(),
    });
  }
  return points;
}

export const DUMMY_DAILY_REPORT = {
  tankId: 'd1',
  date: new Date().toISOString().split('T')[0],
  report: {
    dailyTotal: 14850,
    avgFlowRate: 2.47,
    maxFlowRate: 4.80,
    minFlowRate: 0.30,
    totalReadings: 48,
    firstReadingAt: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    lastReadingAt:  new Date().toISOString(),
  },
};

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DUMMY_WEEKLY_REPORT = {
  tankId: 'd1',
  weekStart: '2026-05-19',
  weekEnd:   '2026-05-25',
  weeklyTotal: 97400,
  dailyBreakdown: days.map((d, i) => {
    const base = 12000 + Math.round(Math.random() * 5000);
    return {
      date: `2026-05-${19 + i}`,
      dailyTotal: base,
      avgFlowRate: parseFloat((base / 1440).toFixed(2)),
      maxFlowRate: parseFloat(((base / 1440) * 2.1).toFixed(2)),
      totalReadings: 48,
    };
  }),
};

const monthDays = Array.from({ length: 23 }, (_, i) => i + 1);
export const DUMMY_MONTHLY_REPORT = {
  tankId: 'd1',
  year: 2026,
  month: 5,
  monthlyTotal: 312500,
  dailyBreakdown: monthDays.map((d) => {
    const base = 11000 + Math.round(Math.random() * 6000);
    return {
      date: `2026-05-${String(d).padStart(2, '0')}`,
      dailyTotal: base,
      avgFlowRate: parseFloat((base / 1440).toFixed(2)),
      maxFlowRate: parseFloat(((base / 1440) * 2.2).toFixed(2)),
      totalReadings: 48,
    };
  }),
};

export const DUMMY_USERS = [
  { _id: 'u1', name: 'Jagadish Behera', email: 'admin@esr.com',    role: 'admin',        createdAt: '2025-01-10T08:00:00Z' },
  { _id: 'u2', name: 'Ravi Kumar',      email: 'ravi@esr.com',     role: 'control_room', createdAt: '2025-02-14T09:30:00Z' },
  { _id: 'u3', name: 'Priya Patel',     email: 'priya@esr.com',    role: 'control_room', createdAt: '2025-03-05T11:15:00Z' },
  { _id: 'u4', name: 'Suresh Nayak',    email: 'suresh@esr.com',   role: 'control_room', createdAt: '2025-04-20T07:45:00Z' },
  { _id: 'u5', name: 'Anita Mohanty',   email: 'anita@esr.com',    role: 'control_room', createdAt: '2025-06-01T10:00:00Z' },
];

export const DUMMY_PROFILE = {
  _id: 'u1',
  name: 'Jagadish Behera',
  email: 'admin@esr.com',
  role: 'admin',
  createdAt: '2025-01-10T08:00:00Z',
};
