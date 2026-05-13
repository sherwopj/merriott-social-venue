import rosette from '../assets/rosette.png'

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

  // Duplicate images for a seamless infinite scroll effect
  const marqueeImages = [...imageUrls, ...imageUrls, ...imageUrls]

  return (
    <div className="gallery-container">
      <div className="gallery-marquee">
        {marqueeImages.map((src, index) => (
          <div key={`${src}-${index}`} className="gallery-marquee__item">
            <img src={src} alt="Gallery item" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
