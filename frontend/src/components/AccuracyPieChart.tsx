// 발음 정확도 파이 차트
import type { AccuracyStats } from '../utils/recordings';

export function AccuracyPieChart({ stats }: { stats: AccuracyStats }) {
  if (!stats || stats.total === 0) return null;

  const { excellent, good, fair, needsPractice, total } = stats;

  const colors = {
    excellent: '#4CAF50',
    good: '#8BC34A',
    fair: '#FF9800',
    needsPractice: '#F44336'
  };

  const data = [
    { label: 'Excellent', count: excellent, percent: (excellent / total * 100), color: colors.excellent },
    { label: 'Good', count: good, percent: (good / total * 100), color: colors.good },
    { label: 'Fair', count: fair, percent: (fair / total * 100), color: colors.fair },
    { label: 'Needs Practice', count: needsPractice, percent: (needsPractice / total * 100), color: colors.needsPractice }
  ];

  let currentAngle = 0;
  const segments = data.filter(d => d.count > 0).map(segment => {
    const angle = (segment.percent / 100) * 360;
    const endAngle = currentAngle + angle;
    
    const startAngleRad = (currentAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const radius = 30;
    const centerX = 35;
    const centerY = 35;
    
    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    currentAngle = endAngle;
    
    return { ...segment, path: pathData };
  });

  return (
    <div className="accuracy-chart">
      <div className="chart-container">
        <svg width="70" height="70" viewBox="0 0 70 70">
          {segments.map((seg, i) => (
            <path
              key={i}
              d={seg.path}
              fill={seg.color}
              stroke="white"
              strokeWidth="1"
            >
              <title>{`${seg.label}: ${seg.count} (${seg.percent.toFixed(1)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="chart-total">{total}</div>
      </div>
      <div className="chart-legend">
        {segments.map((seg, i) => (
          <div key={i} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: seg.color }} />
            <span className="legend-text">{seg.label}: {seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

