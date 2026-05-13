import { Gallery } from '../components/Gallery'
import rosette from '../assets/rosette.png'
import banner from '../assets/banner.png'

const EMAIL_ADDRESS = 'merriottsocialvenue@gmail.com'

export function Home() {
  return (
    <>
      <section className="hero" aria-label="Merriott Social Venue">
        <div className="hero-banner">
          <img
            src={banner}
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
          </div>
          <img src={rosette} className="hero-rosette" alt="Rosette" />
        </div>
      </section>

      <section className="section section--gallery-top">
        <Gallery />
      </section>

      <section className="section section--tight">
        <div className="container prose">
          <h1>Welcome</h1>
          <p>
            Merriott Social Venue is a friendly community club in the heart of Merriott, Somerset. Whether you are after a quiet drink and a game of darts or pool, a club night, or a space to gather with friends and family, you are welcome through our doors, no membership required.
            <br />
            Family and dog friendly.
            <br />
            We are a non profit organisation and are supported by our volunteers. We are always looking for more volunteers, so if you think you could support us, please get in touch!
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
              71 Lower Street
              <br />
              Merriott, Somerset
              <br />
              TA16 5NP
              <br />
              United Kingdom
            </p>
            <p>
              Telephone:{' '}
              <a href="tel:+447471593040">07471 593040</a>
            </p>
            <p>
              Email:{' '}
              <a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a>
            </p>
            <div className="contact-socials">
              <p>
                Follow us:
                <br />
                <a href="https://www.facebook.com/socialclubmerriott" target="_blank" rel="noopener noreferrer">Facebook</a>
                {' | '}
                <a href="https://www.instagram.com/themert1844/" target="_blank" rel="noopener noreferrer">Instagram</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
