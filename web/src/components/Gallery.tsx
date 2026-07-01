import { useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, A11y } from 'swiper/modules'
import Lightbox from 'yet-another-react-lightbox'
import 'swiper/css'
import 'yet-another-react-lightbox/styles.css'

const modules = import.meta.glob<{ default: string }>(
  '../assets/gallery/*.{jpg,jpeg,png,gif,webp,svg}',
  { eager: true, import: 'default' },
)

const imageUrls = Object.values(modules)

export function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (imageUrls.length === 0) {
    return (
      <p className="muted">
        No gallery images yet. Add files to <code>web/src/assets/gallery</code> and rebuild.
      </p>
    )
  }

  return (
    <>
      <div className="gallery-container">
        <Swiper
          modules={[Autoplay, A11y]}
          loop
          autoplay={{ delay: 1800, disableOnInteraction: false, pauseOnMouseEnter: false }}
          slidesPerView="auto"
          spaceBetween={16}
          className="gallery-swiper"
          centeredSlides={false}
          speed={8000}
        >
          {imageUrls.map((src, index) => (
            <SwiperSlide key={src} className="gallery-slide">
              <img
                src={src}
                alt={`Gallery item ${index + 1}`}
                loading="lazy"
                onClick={() => setLightboxIndex(index)}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          open={true}
          close={() => setLightboxIndex(null)}
          slides={imageUrls.map((src) => ({ src }))}
          index={lightboxIndex}
        />
      )}
    </>
  )
}
