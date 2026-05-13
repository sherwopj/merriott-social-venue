import { Gallery } from '../components/Gallery'

const BANNER_SRC = '/banner.jpg'

export function Home() {
  return (
    <>
      <section className="hero" aria-label="Merriott Social Venue">
        <div className="hero-banner">
          <img
            src={BANNER_SRC}
            alt="Merriott Social Venue — The more the Merriott"
            className="hero-banner__img"
            width={1600}
            height={400}
            onError={(e) => {
              const t = e.currentTarget
              t.style.display = 'none'
              const fallback = t.nextElementSibling as HTMLElement | null
              if (fallback) fallback.hidden = false
            }}
          />
          <div className="hero-banner__fallback" hidden>
            <p className="hero-banner__fallback-title">Merriott Social Venue</p>
            <p className="hero-banner__fallback-tagline">The more the Merriott</p>
            <p className="hero-banner__fallback-hint">
              Add your banner image as <code>web/public/banner.jpg</code>
            </p>
          </div>
        </div>
      </section>

      <section className="section section--gallery-top">
        <Gallery />
      </section>

      <section className="section section--tight">
        <div className="container prose">
          <h1>Welcome</h1>
          <p>
            Merriott Social Venue is a friendly community club in the heart of Merriott, Somerset.
            Whether you are after a quiet drink, a club night, or a space to celebrate with friends
            and family, you are welcome through our doors.
          </p>
        </div>
      </section>

      <section className="section section--contact" id="contact">
        <div className="container">
          <h2 className="section-title">Contact</h2>
          <div className="contact-card">
            <p>
              <strong>Merriott Social Venue</strong>
              <br />
              Merriott, Somerset
              <br />
              United Kingdom
            </p>
            <p>
              Email:{' '}
              <a href="mailto:bookings@merriottsocial.example">bookings@merriottsocial.example</a>
            </p>
            <p className="muted small">
              Replace the address and email above with your real details in <code>Home.tsx</code>.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
