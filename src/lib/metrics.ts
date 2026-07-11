export interface Metric {
  label: string;
  value: string | number;
  accent?: boolean;
}

export interface ChartData {
  type: 'line' | 'bar' | 'radar' | 'doughnut';
  labels: string[];
  datasets: { label: string; data: number[]; borderColor: string | string[]; backgroundColor: string | string[]; fill?: boolean }[];
}

export function makeMetrics(title: string, source: string): Metric[] {
  const base = Math.floor(Math.random() * 40) + 60;
  const impact = Math.floor(Math.random() * 50) + 50;
  return [
    { label: 'Impacto', value: impact, accent: true },
    { label: 'Relevancia', value: base, accent: false },
    { label: 'Fuente', value: source, accent: false }
  ];
}

export function makeChart(title: string): ChartData | undefined {
  const rand = (min = 10, max = 100) => Math.floor(Math.random() * (max - min)) + min;
  if (Math.random() > 0.6) return undefined;
  const type = ['bar', 'line', 'radar', 'doughnut'][Math.floor(Math.random() * 4)] as ChartData['type'];
  const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const data = Array.from({ length: 7 }, () => rand(20, 100));
  return {
    type,
    labels,
    datasets: [
      {
        label: 'Tendencia',
        data,
        borderColor: '#00d4aa',
        backgroundColor: type === 'line' ? 'transparent' : '#00d4aa33',
        fill: type === 'line'
      }
    ]
  };
}
