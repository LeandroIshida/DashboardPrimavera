import Card from "./Card";

export default function StatCard({ label, value, unit, className = "" }) {
  return (
    <Card className={className}>
      <div className="stat-label">{label}</div>
      <div className="stat-line">
        <div className="stat-value">{value}</div>
        {unit && <div className="stat-unit">{unit}</div>}
      </div>
    </Card>
  );
}
