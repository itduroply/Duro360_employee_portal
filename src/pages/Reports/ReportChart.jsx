import ColumnChart from '../../components/Charts/ColumnChart.jsx';
import AreaChart from '../../components/Charts/AreaChart.jsx';
import DonutChart from '../../components/Charts/DonutChart.jsx';
import BarList from '../../components/Charts/BarList.jsx';

// Draws a report's `chart` config (see liveReports.js) with the matching chart.
export default function ReportChart({ chart }) {
  switch (chart.type) {
    case 'column':
      return <ColumnChart labels={chart.labels} series={chart.series} format={chart.format} />;
    case 'area':
      return <AreaChart labels={chart.labels} series={chart.series} format={chart.format} />;
    case 'donut':
      return <DonutChart parts={chart.parts} format={chart.format} centerLabel={chart.centerLabel} />;
    case 'bars':
      return chart.rows.length ? <BarList rows={chart.rows} format={chart.format} /> : <p className="py-10 text-center text-theme-sm text-gray-400">No data yet.</p>;
    default:
      return null;
  }
}

// Legend entries for charts with 2+ series (single-series charts are named by their title).
export function legendFor(chart) {
  if (chart.series?.length > 1) {
    return chart.series.map((s) => ({ name: s.name, color: s.color, shape: chart.type === 'area' ? 'line' : 'box' }));
  }
  return [];
}
