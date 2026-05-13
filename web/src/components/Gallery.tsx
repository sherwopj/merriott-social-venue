const modules = import.meta.glob<{ default: string }>(
  '../assets/gallery/*.{jpg,jpeg,png,gif,webp,svg}',
  { eager: true, import: 'default' },
)

const imageUrls = Object.values(modules)

export function Gallery() {
  if (imageUrls.length === 0) {
    return (
      <p className="muted">
        No gallery images yet. Add files to <code>web/src/assets/gallery</code> and rebuild.
      </p>
    )
  }

  return (
    <ul className="gallery-grid">
      {imageUrls.map((src) => (
        <li key={src}>
          <img src={src} alt="" loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  )
}
