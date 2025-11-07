export default function Card({ children, className = "", padded = true }) {
  return (
    <div className={`card ${padded ? "pad" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
