import { Link } from 'react-router-dom'
import constitutionPdf from '../assets/Merriott_Constitution_v4.pdf'

export function Constitution() {
  return (
    <section className="section" aria-labelledby="constitution-title">
      <div className="container">
        <h1 id="constitution-title" className="page-title">
          Constitution
        </h1>
        <p className="lede">
          The Merriott Social Venue constitution is available below.
        </p>

        <div className="constitution-actions">
          <a
            className="btn btn--primary"
            href={constitutionPdf}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open PDF in a new tab
          </a>
          <Link className="btn btn--ghost" to="/">
            Back to home
          </Link>
        </div>

        <div className="constitution-viewer">
          <iframe
            src={constitutionPdf}
            title="Merriott Social Venue Constitution"
            className="constitution-frame"
          />
        </div>
      </div>
    </section>
  )
}
