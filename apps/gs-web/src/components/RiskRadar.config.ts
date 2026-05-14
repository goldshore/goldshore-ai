export type RadarBlip = {
  id: string;
  x: number;
  y: number;
  delay: number;
  duration: number;
  size: number;
};

export const radarBlips: RadarBlip[] = [
  { id: 'alpha', x: 68, y: 34, delay: 0.1, duration: 4.8, size: 10 },
  { id: 'beta', x: 36, y: 62, delay: 1.2, duration: 5.4, size: 12 },
  { id: 'gamma', x: 58, y: 78, delay: 2.1, duration: 4.3, size: 8 },
  { id: 'delta', x: 22, y: 48, delay: 0.8, duration: 5.9, size: 9 },
  { id: 'epsilon', x: 79, y: 57, delay: 2.8, duration: 5.1, size: 11 },
];

export const radarSignals = [
  { label: 'Decision pressure', value: 'Adaptive' },
  { label: 'Sweep interval', value: '2.4s' },
  { label: 'Anomaly queue', value: '5 live' },
];
