import { Link } from 'react-router-dom'

export function Privacy() {
  return (
    <section className="section" aria-labelledby="privacy-title">
      <div className="container container--narrow">
        <h1 id="privacy-title" className="page-title">
          Privacy Policy
        </h1>
        <p className="lede">
          Merriott Social Venue is a small community club run by volunteers. This page explains what
          information we collect through this website and how we use it.
        </p>

        <div className="prose">
          <h2>Function room bookings</h2>
          <p>
            When you submit a booking request, we collect your name, email address, phone number,
            postal address, and the details of your event. This is used to manage your booking,
            confirm availability, and get in touch with you about it. It's stored in a private Google
            Sheet and Google Calendar accessible only to committee members.
          </p>

          <h2>Card payments</h2>
          <p>
            If you pay online, card payments are handled entirely by Stripe, our payment processor —
            we never see or store your card details. We keep a reference to the payment (via Stripe)
            alongside your booking so it can be matched up and, if ever needed, refunded.
          </p>

          <h2>Committee admin sign-in</h2>
          <p>
            Committee members managing bookings and events sign in with their Google account. This is
            used only to confirm they're an authorised committee member; it isn't used for tracking or
            shared with anyone else, and isn't kept beyond the browser session.
          </p>

          <h2>Cookies and tracking</h2>
          <p>
            We don't use advertising or analytics cookies, and we don't share your information with
            third parties for marketing purposes.
          </p>

          <h2>Contact us</h2>
          <p>
            If you have any questions about your data, or would like it removed, email us at{' '}
            <a href="mailto:merriottsocialvenue@gmail.com">merriottsocialvenue@gmail.com</a>.
          </p>
        </div>

        <p className="constitution-actions">
          <Link className="btn btn--ghost" to="/">
            Back to home
          </Link>
        </p>
      </div>
    </section>
  )
}
