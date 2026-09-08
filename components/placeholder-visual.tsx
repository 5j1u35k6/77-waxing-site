type Props = {
  label: string;
  image?: string;
  className?: string;
};

export function PlaceholderVisual({ label, image, className = "" }: Props) {
  return (
    <figure className={`placeholder-visual ${className}`}>
      {image ? <img src={image} alt={label} /> : <div className="placeholder-text">{label}</div>}
      <figcaption>{label}・第一版示意圖</figcaption>
    </figure>
  );
}
