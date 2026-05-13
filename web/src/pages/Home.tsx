import { Gallery } from '../components/Gallery'
import rosette from '../assets/rosette.png'

const EMAIL_ADDRESS = 'merriottsocialvenue@gmail.com'

export function Home() {
  return (
    <>
      <section className="hero" aria-label="Merriott Social Venue">
        <div className="hero-banner">
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
