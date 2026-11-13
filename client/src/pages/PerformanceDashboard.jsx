import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { TrendingUp, TrendingDown, Target, Clock, Brain, Award, BarChart2, PieChart, Activity, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Calendar, Filter } from 'lucide-react';

const DIFFICULTY_COLORS = {
  Easy: { bg: '#203d2a', text: '#7cdb9e', border: '#2e7d43' },
  Medium: { bg: '#4a3b1e', text: '#ffd073', border: '#735722' },
  Hard: { bg: '#4c2928', text: '#f08e85', border: '#8f3d3d' }
};

const TOPIC_COLORS = [
  '#ffa51d', '#7cdb9e', '#f08e85', '#ffd073', '#dfa139', '#34d399',
  '#f472b6', '#60a5fa', '#a78bfa', '#fbbf24', '#fb923c', '#22d3ee'
];

function RadarChart({ data, labels, color = '#ffa51d', size = 280 }) {
  const center = size / 2;
  const radius = size / 2 - 30;
  const angleStep = (Math.PI * 2) / labels.length;

  const getPoint = (value, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const points = data.map(getPoint);
  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const gridPolygons = [0.25, 0.5, 0.75, 1].map(level => {
    const gridPoints = labels.map((_, i) => getPoint(level * 100, i));
    return gridPoints.map(p => `${p.x},${p.y}`).join(' ');
  });

  const axes = labels.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  });

  return (
    <div className="radar-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {gridPolygons.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}

        {axes.map((axis, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={axis.x}
            y2={axis.y}
            stroke="#2a2a2a"
            strokeWidth="1"
          />
        ))}

        <polygon
          points={polygonPoints}
          fill="url(#radarFill)"
          stroke="url(#radarStroke)"
          strokeWidth="2"
          filter="drop-shadow(0 0 8px rgba(255, 165, 29, 0.4))"
        >
          <animate
            attributeName="points"
            from={labels.map(() => `${center},${center}`).join(' ')}
            to={polygonPoints}
            dur="1s"
            fill="freeze"
            calcMode="linear"
          />
        </polygon>

        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={color}
            stroke="#171717"
            strokeWidth="2"
          >
            <animate
              attributeName="r"
              from="0"
              to="5"
              dur="0.3s"
              begin={`${0.8 + i * 0.1}s`}
              fill="freeze"
            />
          </circle>
        ))}
      </svg>

      <div className="radar-labels" style={{ width: size, height: size }}>
        {labels.map((label, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = radius + 35;
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);
          return (
            <div
              key={i}
              className="radar-label"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: `translate(-50%, -50%)`
              }}
            >
              <span>{label}</span>
              <span className="radar-value">{data[i]}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({ data, color = '#ffa51d', height = 200, showPoints = true }) {
  const padding = 40;
  const { points, maxY, minY } = useMemo(() => {
    if (!data.length) return { points: [], maxY: 100, minY: 0 };
    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const chartWidth = 1000;
    const chartHeight = height - padding;

    const pts = data.map((d, i) => ({
      x: padding + (i / (data.length - 1 || 1)) * (chartWidth - padding * 2),
      y: padding + (1 - (d.value - min) / range) * chartHeight,
      value: d.value,
      label: d.label
    }));

    return { points: pts, maxY: max, minY: min };
  }, [data, height]);

  if (!points.length) return <div className="chart-empty">No data available</div>;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = [
    `M ${points[0].x} ${height - padding}`,
    ...points.map(p => `L ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${height - padding}`,
    'Z'
  ].join(' ');

  return (
    <div className="line-chart" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={areaPath}
          fill="url(#areaFill)"
        >
          <animate
            attributeName="d"
            from={[
              `M ${points[0].x} ${height - padding}`,
              ...points.map(() => `L ${points[0].x} ${height - padding}`),
              `L ${points[0].x} ${height - padding}`,
              'Z'
            ].join(' ')}
            to={areaPath}
            dur="1s"
            fill="freeze"
          />
        </path>

        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="drop-shadow(0 0 6px rgba(255, 165, 29, 0.5))"
        >
          <animate
            attributeName="stroke-dasharray"
            from={`0 ${points.reduce((sum, p, i) => sum + (i > 0 ? Math.hypot(p.x - points[i-1].x, p.y - points[i-1].y) : 0), 0)}`}
            to={`0 ${points.reduce((sum, p, i) => sum + (i > 0 ? Math.hypot(p.x - points[i-1].x, p.y - points[i-1].y) : 0), 0)}`}
            dur="1.5s"
            fill="freeze"
          />
        </path>

        {showPoints && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={color}
            stroke="#171717"
            strokeWidth="2"
            className="chart-point"
          >
            <animate
              attributeName="r"
              from="0"
              to="5"
              dur="0.3s"
              begin={`${0.8 + i * 0.05}s`}
              fill="freeze"
            />
          </circle>
        ))}
      </svg>

      <div className="chart-tooltip" style={{ display: 'none' }}>
        <div className="tooltip-content" />
      </div>
    </div>
  );
}

function BarChartComponent({ data, color = '#ffa51d', height = 200, horizontal = false }) {
  const maxVal = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  if (!data.length) return <div className="chart-empty">No data available</div>;

  return (
    <div className={`bar-chart ${horizontal ? 'horizontal' : ''}`} style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${horizontal ? 400 : 500} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * (height - 40);
          const barWidth = horizontal ? barHeight : 35;
          const x = horizontal ? 60 : 50 + i * 55;
          const y = horizontal ? 20 + i * 45 : height - 20 - barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={horizontal ? 35 : barHeight}
                rx={4}
                fill={d.color || color}
                opacity="0"
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to="1"
                  dur="0.5s"
                  begin={`${i * 0.1}s`}
                  fill="freeze"
                />
                <animate
                  attributeName={horizontal ? "width" : "height"}
                  from="0"
                  to={horizontal ? barWidth : barHeight}
                  dur="0.6s"
                  begin={`${i * 0.1}s`}
                  fill="freeze"
                />
                <animate
                  attributeName={horizontal ? "x" : "y"}
                  from={horizontal ? 60 : height - 20}
                  to={horizontal ? 60 : y}
                  dur="0.6s"
                  begin={`${i * 0.1}s`}
                  fill="freeze"
                />
              </rect>
              <text
                x={horizontal ? x + barWidth + 8 : x + barWidth / 2}
                y={horizontal ? y + 24 : y - 8}
                fill="#ddd"
                fontFamily="Manrope"
                fontSize="11"
                fontWeight="700"
                textAnchor={horizontal ? "start" : "middle"}
                opacity="0"
              >
                {d.value}
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${i * 0.1 + 0.5}s`} fill="freeze" />
              </text>
              <text
                x={horizontal ? 55 : x + barWidth / 2}
                y={horizontal ? y + 24 : height - 5}
                fill="#999"
                fontFamily="Manrope"
                fontSize="10"
                textAnchor={horizontal ? "end" : "middle"}
                transform={!horizontal ? `rotate(-45 ${x + barWidth / 2} ${height - 5})` : undefined}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data, size = 160, strokeWidth = 16 }) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={strokeWidth}
        />
        {data.map((d, i) => {
          const prevSum = data.slice(0, i).reduce((sum, item) => sum + item.value, 0);
          const offset = circumference - (prevSum / total) * circumference;
          const dashArray = `${(d.value / total) * circumference} ${circumference}`;

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ filter: `drop-shadow(0 0 4px ${d.color})` }}
            >
              <animate
                attributeName="stroke-dashoffset"
                from={circumference}
                to={offset}
                dur="1s"
                begin={`${i * 0.15}s`}
                fill="freeze"
              />
            </circle>
          );
        })}
      </svg>
      <div className="donut-center">
        <span className="donut-total">{total}</span>
        <span className="donut-label">Total</span>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, color = '#ffa51d', loading = false }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon" style={{ background: `${color}20`, color }}>
          {Icon && <Icon size={20} />}
        </div>
        {trend !== undefined && (
          <div className={`metric-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
            {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="metric-body">
        <div className="metric-value" style={{ color }}>
          {loading ? (
            <Loader2 className="spinning" size={24} />
          ) : (
            value
          )}
        </div>
        <div className="metric-title">{title}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

function DifficultyBreakdown({ stats }) {
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const solvedStats = stats?.solved || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
  const unsolvedStats = stats?.unsolved || { Easy: 0, Medium: 0, Hard: 0 };

  return (
    <div className="difficulty-breakdown-card">
      <h3>Difficulty-wise Performance</h3>
      <div className="difficulty-grid">
        {difficulties.map(diff => {
          const solved = solvedStats[diff] || 0;
          const unsolved = unsolvedStats[diff] || 0;
          const totalDiff = solved + unsolved;
          const rate = totalDiff > 0 ? Math.round((solved / totalDiff) * 100) : 0;
          const colors = DIFFICULTY_COLORS[diff];
          return (
            <div key={diff} className="difficulty-item" style={{ borderColor: colors.border }}>
              <div className="difficulty-header" style={{ color: colors.text }}>
                <span className="difficulty-name">{diff}</span>
                <span className="difficulty-rate">{rate}%</span>
              </div>
              <div className="difficulty-progress">
                <div
                  className="difficulty-bar"
                  style={{
                    width: `${rate}%`,
                    background: colors.text
                  }}
                />
              </div>
              <div className="difficulty-stats">
                <span>{solved} / {totalDiff} solved</span>
                <span className="difficulty-pts">+{solved * (diff === 'Easy' ? 100 : diff === 'Medium' ? 200 : 300)} pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopicStrengths({ topicStats }) {
  const topics = Object.entries(topicStats)
    .map(([topic, data]) => ({ topic, ...data }))
    .sort((a, b) => b.rate - a.rate);

  const strengths = topics.slice(0, 5);
  const weaknesses = topics.slice(-5).reverse();

  return (
    <div className="topic-strengths-card">
      <h3>Topic-wise Analysis</h3>
      <div className="topic-grid">
        <div className="topic-column strengths">
          <div className="topic-column-header">
            <CheckCircle2 size={16} style={{ color: '#7cdb9e' }} />
            <span>Strengths</span>
          </div>
          {strengths.map((t, i) => (
            <div key={t.topic} className="topic-item" style={{ borderLeftColor: TOPIC_COLORS[i] }}>
              <div className="topic-info">
                <span className="topic-name">{t.topic}</span>
                <span className="topic-rate" style={{ color: TOPIC_COLORS[i] }}>{t.rate}%</span>
              </div>
              <div className="topic-mini-bar">
                <div style={{ width: `${t.rate}%`, background: TOPIC_COLORS[i] }} />
              </div>
              <span className="topic-count">{t.solved}/{t.total}</span>
            </div>
          ))}
        </div>
        <div className="topic-column weaknesses">
          <div className="topic-column-header">
            <AlertCircle size={16} style={{ color: '#f08e85' }} />
            <span>Needs Work</span>
          </div>
          {weaknesses.map((t, i) => (
            <div key={t.topic} className="topic-item" style={{ borderLeftColor: TOPIC_COLORS[i + 5] }}>
              <div className="topic-info">
                <span className="topic-name">{t.topic}</span>
                <span className="topic-rate" style={{ color: TOPIC_COLORS[i + 5] }}>{t.rate}%</span>
              </div>
              <div className="topic-mini-bar">
                <div style={{ width: `${t.rate}%`, background: TOPIC_COLORS[i + 5] }} />
              </div>
              <span className="topic-count">{t.solved}/{t.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeComplexityTrends({ submissions }) {
  const monthlyData = useMemo(() => {
    const months = {};
    submissions.forEach(s => {
      const date = new Date(s.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { accepted: 0, total: 0, avgTime: 0, timeSum: 0 };
      months[key].total++;
      if (s.verdict === 'Accepted') {
        months[key].accepted++;
        months[key].timeSum += s.runtime_ms || 0;
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        label: new Date(month + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        accuracy: data.total > 0 ? Math.round((data.accepted / data.total) * 100) : 0,
        avgTime: data.accepted > 0 ? Math.round(data.timeSum / data.accepted) : 0
      }));
  }, [submissions]);

  return (
    <div className="trends-card">
      <h3>Performance Trends (Last 12 Months)</h3>
      <div className="trends-tabs">
        <button className="trend-tab active">Accuracy %</button>
        <button className="trend-tab">Avg Runtime (ms)</button>
      </div>
      <LineChart
        data={monthlyData.map(d => ({ label: d.label, value: d.accuracy }))}
        color="#7cdb9e"
        height={220}
      />
      <LineChart
        data={monthlyData.map(d => ({ label: d.label, value: d.avgTime }))}
        color="#ffa51d"
        height={220}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export function PerformanceDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [user, timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, submissionsRes, analyticsRes] = await Promise.all([
        api.get('/users/me/profile'),
        api.get('/submissions/me'),
        api.get(`/analytics/dashboard?range=${timeRange}`).catch(() => ({ data: null }))
      ]);

      const profile = profileRes.data;
      const submissions = submissionsRes.data || [];
      const analytics = analyticsRes.data || {};

      const recentSubs = submissions.slice(0, 50);
      const acceptedSubs = submissions.filter(s => s.verdict === 'Accepted');
      const totalSubs = submissions.length;
      const acceptanceRate = totalSubs > 0 ? Math.round((acceptedSubs.length / totalSubs) * 100) : 0;

      const avgRuntime = acceptedSubs.length > 0
        ? Math.round(acceptedSubs.reduce((sum, s) => sum + (s.runtime_ms || 0), 0) / acceptedSubs.length)
        : 0;

      const topicStats = {};
      submissions.forEach(s => {
        const tags = s.tags?.split(',').map(t => t.trim()) || ['General'];
        tags.forEach(tag => {
          if (!topicStats[tag]) topicStats[tag] = { solved: 0, total: 0 };
          topicStats[tag].total++;
          if (s.verdict === 'Accepted') topicStats[tag].solved++;
        });
      });
      Object.keys(topicStats).forEach(tag => {
        topicStats[tag].rate = topicStats[tag].total > 0
          ? Math.round((topicStats[tag].solved / topicStats[tag].total) * 100)
          : 0;
      });

      const difficultyStats = { Easy: { solved: 0, unsolved: 0 }, Medium: { solved: 0, unsolved: 0 }, Hard: { solved: 0, unsolved: 0 } };
      const problemSet = new Set();
      submissions.forEach(s => {
        const key = `${s.problem_id}-${s.verdict}`;
        if (problemSet.has(key)) return;
        problemSet.add(key);
        const diff = s.difficulty;
        if (difficultyStats[diff]) {
          if (s.verdict === 'Accepted') difficultyStats[diff].solved++;
          else difficultyStats[diff].unsolved++;
        }
      });

      setDashboardData({
        profile,
        stats: {
          totalSubmissions: totalSubs,
          totalAccepted: acceptedSubs.length,
          acceptanceRate,
          avgRuntime,
          score: profile.stats?.score || 0,
          rank: profile.stats?.rank || null,
          solved: profile.stats?.solved || { Total: 0, Easy: 0, Medium: 0, Hard: 0 },
          totals: profile.stats?.totals || { Total: 0, Easy: 0, Medium: 0, Hard: 0 },
          difficultyStats,
          topicStats,
          recentSubs
        }
      });
    } catch (err) {
      if (err?.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError('Failed to load dashboard data');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <section className="content page">
        <div className="error-state">
          <AlertCircle size={48} style={{ color: '#ffa51d' }} />
          <h3>Log in to view your analytics</h3>
          <Link to="/login" className="button">Log in</Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="content page">
        <div className="loading-dashboard">
          <Loader2 className="spinning" size={40} style={{ color: '#ffa51d' }} />
          <p>Loading performance analytics...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="content page">
        <div className="error-state">
          <AlertCircle size={48} style={{ color: '#f08e85' }} />
          <h3>{error}</h3>
          <button className="button" onClick={fetchDashboardData}>Retry</button>
        </div>
      </section>
    );
  }

  if (!dashboardData || !dashboardData.stats) {
    return (
      <section className="content page">
        <div className="error-state">
          <AlertCircle size={48} style={{ color: '#f08e85' }} />
          <h3>Failed to load dashboard data</h3>
          <button className="button" onClick={fetchDashboardData}>Retry</button>
        </div>
      </section>
    );
  }

  const { stats, profile } = dashboardData;
  const safeSolved = stats.solved || { Total: 0, Easy: 0, Medium: 0, Hard: 0 };
  const safeTotals = stats.totals || { Total: 0, Easy: 0, Medium: 0, Hard: 0 };
  const safeDifficultyStats = stats.difficultyStats || { Easy: { solved: 0, unsolved: 0 }, Medium: { solved: 0, unsolved: 0 }, Hard: { solved: 0, unsolved: 0 } };
  const safeTopicStats = stats.topicStats || {};
  const safeRecentSubs = Array.isArray(stats.recentSubs) ? stats.recentSubs : [];
  const overallScore = stats.acceptanceRate || 0;

  const radarData = [
    overallScore,
    Math.min(100, Math.round((safeSolved.Total / Math.max(1, safeTotals.Total)) * 100)),
    Math.min(100, Math.round(stats.avgRuntime > 0 ? Math.max(0, 100 - stats.avgRuntime / 50) : 50)),
    Math.min(100, (stats.totalSubmissions || 0) > 10 ? 80 : (stats.totalSubmissions || 0) * 8),
    Math.min(100, Object.keys(safeTopicStats).length * 10)
  ];

  const radarLabels = ['Accuracy', 'Completion', 'Speed', 'Consistency', 'Versatility'];

  return (
    <section className="content page performance-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Performance Analytics</h1>
          <p className="muted">Track your coding progress, identify strengths, and optimize weaknesses</p>
        </div>
        <div className="dashboard-controls">
          <select
            className="filter-select"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard
          title="Overall Score"
          value={`${overallScore}%`}
          subtitle="Acceptance Rate"
          icon={Target}
          color={DIFFICULTY_COLORS.Easy.text}
          trend={5}
        />
        <MetricCard
          title="Problems Solved"
          value={safeSolved.Total}
          subtitle={`of ${safeTotals.Total} total`}
          icon={CheckCircle2}
          color="#ffa51d"
          trend={12}
        />
        <MetricCard
          title="Avg Runtime"
          value={`${stats.avgRuntime || 0} ms`}
          subtitle="On accepted solutions"
          icon={Clock}
          color="#ffd073"
          trend={-8}
        />
        <MetricCard
          title="Total Submissions"
          value={stats.totalSubmissions}
          subtitle={`${stats.totalAccepted} accepted`}
          icon={Activity}
          color="#dfa139"
        />
        <MetricCard
          title="Community Rank"
          value={stats.rank ? `#${stats.rank}` : '—'}
          subtitle="Global leaderboard"
          icon={Award}
          color="#f472b6"
        />
        <MetricCard
          title="Active Topics"
          value={Object.keys(safeTopicStats).length}
          subtitle="Tags practiced"
          icon={Brain}
          color="#60a5fa"
        />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="dashboard-card radar-card">
            <div className="card-header">
              <h3>Skill Radar</h3>
              <p className="muted">Overall competency across key dimensions</p>
            </div>
            <div className="radar-wrapper">
              <RadarChart data={radarData} labels={radarLabels} color="#ffa51d" size={320} />
            </div>
            <div className="radar-legend">
              {radarLabels.map((label, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ background: '#ffa51d' }} />
                  <span>{label}: {radarData[i]}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-header">
              <h3>Difficulty-wise Success Rate</h3>
              <p className="muted">Performance across problem difficulties</p>
            </div>
            <BarChartComponent
              data={['Easy', 'Medium', 'Hard'].map(diff => {
                const solved = safeDifficultyStats[diff]?.solved || 0;
                const total = solved + (safeDifficultyStats[diff]?.unsolved || 0);
                const rate = total > 0 ? Math.round((solved / total) * 100) : 0;
                return {
                  label: diff,
                  value: rate,
                  color: DIFFICULTY_COLORS[diff].text
                };
              })}
              color="#ffa51d"
              height={220}
            />
          </div>

          <TimeComplexityTrends submissions={safeRecentSubs} />
        </div>

        <div className="dashboard-sidebar">
          <DifficultyBreakdown stats={{ solved: safeSolved, unsolved: { Easy: 0, Medium: 0, Hard: 0 } }} />

          <div className="dashboard-card topic-card">
            <TopicStrengths topicStats={safeTopicStats} />
          </div>

          <div className="dashboard-card activity-card">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <p className="muted">Last 10 submissions</p>
            </div>
            <div className="activity-list">
              {safeRecentSubs.slice(0, 10).map(sub => (
                <div key={sub.id} className="activity-item">
                  <div className="activity-result">
                    <span className={`verdict-dot ${sub.verdict === 'Accepted' ? 'success' : 'danger'}`} />
                    <span className="activity-verdict">{sub.verdict}</span>
                  </div>
                  <div className="activity-details">
                    <span className="activity-problem">{sub.problem_title}</span>
                    <span className="activity-meta">
                      {sub.language} · {sub.runtime_ms ? `${sub.runtime_ms}ms` : '-'}
                    </span>
                  </div>
                  <span className="activity-time">
                    {new Date(sub.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


    </section>
  );
}
