import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import type { PublicUser } from '../types.ts';

type MetricKey = 'acceptance' | 'scholarship' | 'velocity';
type HorizonKey = 'annual' | 'quarterly';

interface DataPoint {
  period: string;
  shortLabel: string;
  studyGlobe: number;
  baseline: number;
  sampleSize: string;
  highlight: string;
}

interface RegionMetric {
  region: string;
  corridorHint: string;
  valueLabel: string;
  percent: number;
  delta: string;
  countryToFilter: string;
}

interface MetricDataset {
  id: MetricKey;
  tabLabel: string;
  title: string;
  subtitle: string;
  unitSuffix: string;
  unitPrefix: string;
  studyGlobeLabel: string;
  baselineLabel: string;
  yMin: number;
  yMax: number;
  higherIsBetter: boolean;
  annual: DataPoint[];
  quarterly: DataPoint[];
  regions: RegionMetric[];
}

const METRIC_DATASETS: Record<MetricKey, MetricDataset> = {
  acceptance: {
    id: 'acceptance',
    tabLabel: 'Acceptance Rate',
    title: 'First-Choice Admission Acceptance Rate',
    subtitle: 'Verified cohort offer rate across partner universities vs. unassisted international applicants.',
    unitPrefix: '',
    unitSuffix: '%',
    studyGlobeLabel: 'StudyGlobe Cohort',
    baselineLabel: 'Unassisted Baseline',
    yMin: 30,
    yMax: 100,
    higherIsBetter: true,
    annual: [
      {
        period: '2021 Cohort',
        shortLabel: '2021',
        studyGlobe: 68.2,
        baseline: 44.5,
        sampleSize: '1,420 students',
        highlight: 'Initial European & UK partner intake',
      },
      {
        period: '2022 Cohort',
        shortLabel: '2022',
        studyGlobe: 73.6,
        baseline: 45.8,
        sampleSize: '2,180 students',
        highlight: 'SOP & transcript pre-screening added',
      },
      {
        period: '2023 Cohort',
        shortLabel: '2023',
        studyGlobe: 78.9,
        baseline: 46.2,
        sampleSize: '2,940 students',
        highlight: 'Alumni 1-on-1 mock interviews launched',
      },
      {
        period: '2024 Cohort',
        shortLabel: '2024',
        studyGlobe: 83.4,
        baseline: 47.0,
        sampleSize: '3,610 students',
        highlight: 'Expanded Asia-Pacific & DACH tracks',
      },
      {
        period: '2025 Cohort',
        shortLabel: '2025',
        studyGlobe: 86.7,
        baseline: 47.9,
        sampleSize: '4,290 students',
        highlight: 'AI profile fit scoring & deadline triage',
      },
      {
        period: '2026 Cohort',
        shortLabel: '2026',
        studyGlobe: 89.4,
        baseline: 48.3,
        sampleSize: '4,890 students',
        highlight: 'Record QS Top-50 admission conversion',
      },
    ],
    quarterly: [
      {
        period: 'Q1 2025',
        shortLabel: "Q1 '25",
        studyGlobe: 84.5,
        baseline: 47.2,
        sampleSize: '980 students',
        highlight: 'Spring European rolling intake',
      },
      {
        period: 'Q2 2025',
        shortLabel: "Q2 '25",
        studyGlobe: 85.8,
        baseline: 47.5,
        sampleSize: '1,090 students',
        highlight: 'UK & Canada conditional offers',
      },
      {
        period: 'Q3 2025',
        shortLabel: "Q3 '25",
        studyGlobe: 86.9,
        baseline: 47.8,
        sampleSize: '1,140 students',
        highlight: 'Autumn enrollment & visa clearance',
      },
      {
        period: 'Q4 2025',
        shortLabel: "Q4 '25",
        studyGlobe: 87.6,
        baseline: 48.0,
        sampleSize: '1,180 students',
        highlight: 'Early-action PhD & MSc wave',
      },
      {
        period: 'Q1 2026',
        shortLabel: "Q1 '26",
        studyGlobe: 88.3,
        baseline: 48.1,
        sampleSize: '1,210 students',
        highlight: 'ETH Zurich & TUM winter cycle',
      },
      {
        period: 'Q2 2026',
        shortLabel: "Q2 '26",
        studyGlobe: 89.4,
        baseline: 48.3,
        sampleSize: '1,260 students',
        highlight: 'Peak scholarship-backed offers',
      },
    ],
    regions: [
      {
        region: 'Europe (DACH & NL)',
        corridorHint: 'Switzerland, Germany, Netherlands',
        valueLabel: '91.8%',
        percent: 91.8,
        delta: '+22.4 pts vs 2021',
        countryToFilter: 'Germany',
      },
      {
        region: 'United Kingdom',
        corridorHint: 'Oxford, Cambridge, Imperial, UCL',
        valueLabel: '87.5%',
        percent: 87.5,
        delta: '+18.9 pts vs 2021',
        countryToFilter: 'United Kingdom',
      },
      {
        region: 'North America',
        corridorHint: 'Canada & United States',
        valueLabel: '85.2%',
        percent: 85.2,
        delta: '+17.1 pts vs 2021',
        countryToFilter: 'Canada',
      },
      {
        region: 'Asia-Pacific',
        corridorHint: 'Japan, Singapore, South Korea',
        valueLabel: '90.4%',
        percent: 90.4,
        delta: '+20.6 pts vs 2021',
        countryToFilter: 'Japan',
      },
    ],
  },
  scholarship: {
    id: 'scholarship',
    tabLabel: 'Scholarship Aid',
    title: 'Cumulative Scholarship Aid Secured ($M)',
    subtitle: 'Annual merit, fellowship, and tuition-waiver funding awarded to StudyGlobe applicants.',
    unitPrefix: '$',
    unitSuffix: 'M',
    studyGlobeLabel: 'StudyGlobe Awards ($M)',
    baselineLabel: 'Avg Peer Cohort ($M)',
    yMin: 0,
    yMax: 22,
    higherIsBetter: true,
    annual: [
      {
        period: '2021 Cohort',
        shortLabel: '2021',
        studyGlobe: 4.2,
        baseline: 1.9,
        sampleSize: '610 awards',
        highlight: 'DAAD & Chevening starter cohort',
      },
      {
        period: '2022 Cohort',
        shortLabel: '2022',
        studyGlobe: 6.8,
        baseline: 2.4,
        sampleSize: '940 awards',
        highlight: 'ETH Excellence & MEXT expansion',
      },
      {
        period: '2023 Cohort',
        shortLabel: '2023',
        studyGlobe: 9.5,
        baseline: 2.9,
        sampleSize: '1,320 awards',
        highlight: 'Need-based urgency alerts added',
      },
      {
        period: '2024 Cohort',
        shortLabel: '2024',
        studyGlobe: 12.7,
        baseline: 3.4,
        sampleSize: '1,790 awards',
        highlight: 'Full-tuition STEM grants doubled',
      },
      {
        period: '2025 Cohort',
        shortLabel: '2025',
        studyGlobe: 15.8,
        baseline: 4.0,
        sampleSize: '2,180 awards',
        highlight: 'Global Fellowship fee waivers live',
      },
      {
        period: '2026 Cohort',
        shortLabel: '2026',
        studyGlobe: 18.6,
        baseline: 4.5,
        sampleSize: '2,540 awards',
        highlight: 'Avg $19,400 grant per recipient',
      },
    ],
    quarterly: [
      {
        period: 'Q1 2025',
        shortLabel: "Q1 '25",
        studyGlobe: 12.9,
        baseline: 3.5,
        sampleSize: '490 awards',
        highlight: 'Winter fellowship disbursements',
      },
      {
        period: 'Q2 2025',
        shortLabel: "Q2 '25",
        studyGlobe: 14.1,
        baseline: 3.7,
        sampleSize: '540 awards',
        highlight: 'Chevening & Erasmus decisions',
      },
      {
        period: 'Q3 2025',
        shortLabel: "Q3 '25",
        studyGlobe: 15.2,
        baseline: 3.9,
        sampleSize: '560 awards',
        highlight: 'MEXT & NUS Merit allocations',
      },
      {
        period: 'Q4 2025',
        shortLabel: "Q4 '25",
        studyGlobe: 16.4,
        baseline: 4.1,
        sampleSize: '610 awards',
        highlight: 'Knight-Hennessy & Swiss Excellence',
      },
      {
        period: 'Q1 2026',
        shortLabel: "Q1 '26",
        studyGlobe: 17.5,
        baseline: 4.3,
        sampleSize: '640 awards',
        highlight: 'Early graduate research stipends',
      },
      {
        period: 'Q2 2026',
        shortLabel: "Q2 '26",
        studyGlobe: 18.6,
        baseline: 4.5,
        sampleSize: '680 awards',
        highlight: 'All-time quarterly funding peak',
      },
    ],
    regions: [
      {
        region: 'North America',
        corridorHint: 'Fellowships & RA/TA stipends',
        valueLabel: '$6.9M',
        percent: 88,
        delta: '+310% vs 2021',
        countryToFilter: 'United States',
      },
      {
        region: 'Europe (DACH & NL)',
        corridorHint: 'DAAD, ETH ESOP & NL Scholarships',
        valueLabel: '$5.1M',
        percent: 76,
        delta: '+345% vs 2021',
        countryToFilter: 'Switzerland',
      },
      {
        region: 'United Kingdom',
        corridorHint: 'Chevening, Clarendon & Gates',
        valueLabel: '$3.8M',
        percent: 64,
        delta: '+290% vs 2021',
        countryToFilter: 'United Kingdom',
      },
      {
        region: 'Asia-Pacific',
        corridorHint: 'MEXT, NUS & KAIST full waivers',
        valueLabel: '$2.8M',
        percent: 54,
        delta: '+360% vs 2021',
        countryToFilter: 'Singapore',
      },
    ],
  },
  velocity: {
    id: 'velocity',
    tabLabel: 'Readiness & Match Accuracy',
    title: 'Admission Match Precision & Readiness Score',
    subtitle: 'Alignment between AI admission forecasts and actual university offer outcomes over time.',
    unitPrefix: '',
    unitSuffix: '%',
    studyGlobeLabel: 'Forecast Precision',
    baselineLabel: 'Manual Guessing Baseline',
    yMin: 40,
    yMax: 100,
    higherIsBetter: true,
    annual: [
      {
        period: '2021 Cohort',
        shortLabel: '2021',
        studyGlobe: 74.1,
        baseline: 51.0,
        sampleSize: '28 days avg prep',
        highlight: 'Static GPA & country checklists',
      },
      {
        period: '2022 Cohort',
        shortLabel: '2022',
        studyGlobe: 79.4,
        baseline: 51.5,
        sampleSize: '22 days avg prep',
        highlight: 'Weighted rubric for QS rankings',
      },
      {
        period: '2023 Cohort',
        shortLabel: '2023',
        studyGlobe: 84.8,
        baseline: 52.0,
        sampleSize: '17 days avg prep',
        highlight: 'Encrypted vault doc readiness check',
      },
      {
        period: '2024 Cohort',
        shortLabel: '2024',
        studyGlobe: 89.2,
        baseline: 52.4,
        sampleSize: '13 days avg prep',
        highlight: 'Gemini AI scholarship & SOP calibration',
      },
      {
        period: '2025 Cohort',
        shortLabel: '2025',
        studyGlobe: 92.1,
        baseline: 52.8,
        sampleSize: '10 days avg prep',
        highlight: 'Visa & cost-of-living pre-validation',
      },
      {
        period: '2026 Cohort',
        shortLabel: '2026',
        studyGlobe: 94.3,
        baseline: 53.1,
        sampleSize: '8.5 days avg prep',
        highlight: '3.3x faster application readiness',
      },
    ],
    quarterly: [
      {
        period: 'Q1 2025',
        shortLabel: "Q1 '25",
        studyGlobe: 90.4,
        baseline: 52.5,
        sampleSize: '11.5 days avg prep',
        highlight: 'Checklist auto-sync enabled',
      },
      {
        period: 'Q2 2025',
        shortLabel: "Q2 '25",
        studyGlobe: 91.3,
        baseline: 52.6,
        sampleSize: '10.8 days avg prep',
        highlight: 'IELTS/TOEFL threshold calibration',
      },
      {
        period: 'Q3 2025',
        shortLabel: "Q3 '25",
        studyGlobe: 92.2,
        baseline: 52.8,
        sampleSize: '10.0 days avg prep',
        highlight: 'Country visa milestone presets',
      },
      {
        period: 'Q4 2025',
        shortLabel: "Q4 '25",
        studyGlobe: 93.0,
        baseline: 52.9,
        sampleSize: '9.4 days avg prep',
        highlight: 'Real-time vault compliance tags',
      },
      {
        period: 'Q1 2026',
        shortLabel: "Q1 '26",
        studyGlobe: 93.8,
        baseline: 53.0,
        sampleSize: '8.9 days avg prep',
        highlight: 'Multi-country fee waiver routing',
      },
      {
        period: 'Q2 2026',
        shortLabel: "Q2 '26",
        studyGlobe: 94.3,
        baseline: 53.1,
        sampleSize: '8.5 days avg prep',
        highlight: 'Highest historical forecast accuracy',
      },
    ],
    regions: [
      {
        region: 'Europe (DACH & NL)',
        corridorHint: '96.1% checklist completion',
        valueLabel: '95.4%',
        percent: 95.4,
        delta: '+20.1 pts vs 2021',
        countryToFilter: 'Netherlands',
      },
      {
        region: 'Asia-Pacific',
        corridorHint: '94.8% visa-ready before cutoff',
        valueLabel: '94.2%',
        percent: 94.2,
        delta: '+19.5 pts vs 2021',
        countryToFilter: 'Singapore',
      },
      {
        region: 'United Kingdom',
        corridorHint: '92.9% CAS & reference readiness',
        valueLabel: '93.6%',
        percent: 93.6,
        delta: '+18.8 pts vs 2021',
        countryToFilter: 'United Kingdom',
      },
      {
        region: 'North America',
        corridorHint: '91.7% funding proof verified',
        valueLabel: '92.8%',
        percent: 92.8,
        delta: '+18.0 pts vs 2021',
        countryToFilter: 'Canada',
      },
    ],
  },
};

interface HistoricalTrendsSectionProps {
  currentUser: PublicUser | null;
  onOpenAuth: (mode: 'login' | 'register' | 'admin') => void;
  onEnterWorkspace: () => void;
  onFilterByCountry?: (country: string) => void;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export const HistoricalTrendsSection: React.FC<HistoricalTrendsSectionProps> = ({
  currentUser,
  onOpenAuth,
  onEnterWorkspace,
  onFilterByCountry,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('acceptance');
  const [horizon, setHorizon] = useState<HorizonKey>('annual');
  const [activePointIndex, setActivePointIndex] = useState<number>(5);

  const dataset = METRIC_DATASETS[selectedMetric];
  const series = horizon === 'annual' ? dataset.annual : dataset.quarterly;
  const clampedIndex = Math.min(activePointIndex, series.length - 1);
  const activePoint = series[clampedIndex];
  const firstPoint = series[0];

  const growthDelta = activePoint.studyGlobe - firstPoint.studyGlobe;
  const baselineAdvantage = activePoint.studyGlobe - activePoint.baseline;

  // Chart SVG coordinate space
  const svgW = 720;
  const svgH = 264;
  const padL = 52;
  const padR = 24;
  const padT = 22;
  const padB = 38;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const { studyPoints, baselinePoints, areaPath, studyPath, baselinePath, yTicks } = useMemo(() => {
    const span = Math.max(1, dataset.yMax - dataset.yMin);
    const toX = (idx: number) =>
      series.length <= 1 ? padL + plotW / 2 : padL + (idx / (series.length - 1)) * plotW;
    const toY = (val: number) => padT + plotH - ((val - dataset.yMin) / span) * plotH;

    const sPts = series.map((pt, idx) => ({ x: toX(idx), y: toY(pt.studyGlobe), data: pt }));
    const bPts = series.map((pt, idx) => ({ x: toX(idx), y: toY(pt.baseline), data: pt }));

    const sPath = buildSmoothPath(sPts);
    const bPath = buildSmoothPath(bPts);
    const last = sPts[sPts.length - 1];
    const first = sPts[0];
    const bottomY = padT + plotH;
    const aPath =
      sPts.length > 0
        ? `${sPath} L ${last.x.toFixed(1)} ${bottomY.toFixed(1)} L ${first.x.toFixed(1)} ${bottomY.toFixed(1)} Z`
        : '';

    const steps = 4;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => {
      const val = dataset.yMin + (span * i) / steps;
      return {
        value: val,
        y: toY(val),
        label: `${dataset.unitPrefix}${Number.isInteger(val) ? val : val.toFixed(0)}${dataset.unitSuffix}`,
      };
    });

    return {
      studyPoints: sPts,
      baselinePoints: bPts,
      areaPath: aPath,
      studyPath: sPath,
      baselinePath: bPath,
      yTicks: ticks,
    };
  }, [dataset, series, plotW, plotH]);

  const activeCoord = studyPoints[clampedIndex];
  const activeBaseCoord = baselinePoints[clampedIndex];

  const formatValue = (v: number) =>
    `${dataset.unitPrefix}${v.toFixed(1)}${dataset.unitSuffix}`;

  const handleRegionJump = (country: string) => {
    if (onFilterByCountry) {
      onFilterByCountry(country);
    }
    const target = document.getElementById('universities');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      id="performance-trends"
      aria-labelledby="historical-trends-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-10"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header & Interactive Controls */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Historical Performance Metrics · 2021–2026 Verified Student Cohorts
            </p>
            <h2
              id="historical-trends-heading"
              className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]"
            >
              Student Outcomes & Scholarship Trends Over Time
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Inspect multi-year admission conversion, secured funding volume, and application readiness benchmarks across 14,820+ applicants.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {/* Metric Segmented Control */}
            <div
              role="tablist"
              aria-label="Select historical performance metric"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-x-auto"
            >
              {(['acceptance', 'scholarship', 'velocity'] as MetricKey[]).map((key) => {
                const active = selectedMetric === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedMetric(key);
                      setActivePointIndex(series.length - 1);
                    }}
                    className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {METRIC_DATASETS[key].tabLabel}
                  </button>
                );
              })}
            </div>

            {/* Horizon Segmented Control */}
            <div
              role="group"
              aria-label="Select time granularity"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start sm:self-auto"
            >
              {([
                { id: 'annual', label: 'Annual' },
                { id: 'quarterly', label: 'Quarterly' },
              ] as const).map((item) => {
                const active = horizon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setHorizon(item.id);
                      setActivePointIndex(series.length - 1);
                    }}
                    className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Analytical Grid: 8-Col Trend Visualization + 4-Col Regional Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left: Interactive SVG Area & Line Trend Chart */}
          <div className="lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {dataset.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {dataset.subtitle}
                </p>
              </div>

              <div className="flex items-baseline gap-3 shrink-0">
                <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
                  {formatValue(activePoint.studyGlobe)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    +{growthDelta.toFixed(1)}
                    {dataset.unitSuffix || ' pts'} since {firstPoint.shortLabel}
                  </span>
                </span>
              </div>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-5">
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-blue-600 dark:bg-blue-400 inline-block" aria-hidden="true" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{dataset.studyGlobeLabel}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-0 border-t-2 border-dashed border-slate-400 dark:border-slate-500 inline-block" aria-hidden="true" />
                  <span>{dataset.baselineLabel}</span>
                </span>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Inspecting: {activePoint.period} · Hover or tap points
              </span>
            </div>

            {/* Responsive Interactive SVG Chart */}
            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                role="img"
                aria-label={`${dataset.title} historical trend chart from ${firstPoint.shortLabel} to ${series[series.length - 1].shortLabel}`}
                className="w-full h-auto select-none overflow-visible"
              >
                <defs>
                  <linearGradient id={`sg-area-${dataset.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines & Y-Axis Labels */}
                {yTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={padL}
                      y1={tick.y}
                      x2={svgW - padR}
                      y2={tick.y}
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeDasharray={idx === 0 ? undefined : '3 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* Area Fill */}
                <path d={areaPath} fill={`url(#sg-area-${dataset.id})`} />

                {/* Active Vertical Crosshair */}
                {activeCoord && (
                  <line
                    x1={activeCoord.x}
                    y1={padT}
                    x2={activeCoord.x}
                    y2={padT + plotH}
                    className="stroke-blue-500/40 dark:stroke-blue-400/40"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                )}

                {/* Unassisted Baseline Curve */}
                <path
                  d={baselinePath}
                  fill="none"
                  className="stroke-slate-400 dark:stroke-slate-500"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                />

                {/* StudyGlobe Primary Curve */}
                <path
                  d={studyPath}
                  fill="none"
                  className="stroke-blue-600 dark:stroke-blue-400"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Baseline Active Marker */}
                {activeBaseCoord && (
                  <circle
                    cx={activeBaseCoord.x}
                    cy={activeBaseCoord.y}
                    r="4"
                    className="fill-slate-500 dark:fill-slate-400 stroke-white dark:stroke-slate-900"
                    strokeWidth="2"
                  />
                )}

                {/* Interactive Data Points + X-Axis Labels */}
                {studyPoints.map((pt, idx) => {
                  const isActive = idx === clampedIndex;
                  return (
                    <g key={pt.data.shortLabel}>
                      <text
                        x={pt.x}
                        y={svgH - 10}
                        textAnchor="middle"
                        className={`text-[11px] font-mono ${
                          isActive
                            ? 'fill-blue-600 dark:fill-blue-400 font-semibold'
                            : 'fill-slate-500 dark:fill-slate-400'
                        }`}
                      >
                        {pt.data.shortLabel}
                      </text>

                      {/* Visible node */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 6 : 4}
                        className={
                          isActive
                            ? 'fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-slate-900'
                            : 'fill-white dark:fill-slate-900 stroke-blue-600 dark:stroke-blue-400'
                        }
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {/* Value callout above active point */}
                      {isActive && (
                        <g transform={`translate(${Math.min(Math.max(pt.x, padL + 42), svgW - padR - 42)}, ${Math.max(pt.y - 16, 16)})`}>
                          <rect
                            x="-36"
                            y="-15"
                            width="72"
                            height="20"
                            rx="5"
                            className="fill-slate-900 dark:fill-blue-600"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            className="fill-white text-[11px] font-mono font-semibold"
                          >
                            {formatValue(pt.data.studyGlobe)}
                          </text>
                        </g>
                      )}

                      {/* Accessible large interactive hit target */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="22"
                        fill="transparent"
                        role="button"
                        tabIndex={0}
                        aria-label={`${pt.data.period}: ${formatValue(pt.data.studyGlobe)} vs baseline ${formatValue(pt.data.baseline)}`}
                        className="cursor-pointer focus:outline-none"
                        onMouseEnter={() => setActivePointIndex(idx)}
                        onFocus={() => setActivePointIndex(idx)}
                        onClick={() => setActivePointIndex(idx)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected Period Detail Strip */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Selected Period</span>
                <span className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white block">
                  {activePoint.period}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Advantage vs. Baseline</span>
                <span className="mt-0.5 font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 block">
                  +{baselineAdvantage.toFixed(1)}
                  {dataset.unitSuffix || ' pts'} higher
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Verified Sample</span>
                <span className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-white block">
                  {activePoint.sampleSize}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Milestone Driver</span>
                <span className="mt-0.5 font-medium text-slate-800 dark:text-slate-200 block">
                  {activePoint.highlight}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Regional Performance Breakdown & Conversion CTA */}
          <div className="lg:col-span-4 p-5 sm:p-6 flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Performance by Study Corridor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select any region to filter live university programs below.
              </p>

              <div className="mt-5 space-y-4">
                {dataset.regions.map((item) => (
                  <button
                    key={item.region}
                    type="button"
                    onClick={() => handleRegionJump(item.countryToFilter)}
                    className="w-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1 -m-1 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors inline-flex items-center gap-1">
                        <span>{item.region}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {item.valueLabel}
                      </span>
                    </div>

                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(8, item.percent))}%` }}
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{item.corridorHint}</span>
                      <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                        {item.delta}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-900 dark:text-white">2026–2027 Intake Ready:</span>{' '}
                Benchmark your GPA and English score against historical cohort admits in seconds.
              </div>
              <button
                type="button"
                onClick={() => (currentUser ? onEnterWorkspace() : onOpenAuth('register'))}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <span>{currentUser ? 'Open My Admission Workspace' : 'Start Free & Check Your Fit'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
