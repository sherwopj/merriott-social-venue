const EMAIL_ADDRESS = 'merriottsocialvenue@gmail.com'
const PHONE_NUMBER = '07471 593040'

export function Join() {
  const mailtoSubject = encodeURIComponent('Expression of Interest - Joining the Committee')
  const mailtoBody = encodeURIComponent(
    `Hi team,\n\nI care about our community and would like to find out more about joining the committee at Merriott Social Venue!\n\nMy Name:\nMy Phone:\n\nBest regards,\n[Your Name]`,
  )
  const mailtoUrl = `mailto:${EMAIL_ADDRESS}?subject=${mailtoSubject}&body=${mailtoBody}`

  return (
    <section className="section section--join">
      <div className="container container--narrow">
        <h1 className="page-title">Join the Committee</h1>
        
        <div className="join-content">
          <div className="prose">
            <p className="lede">
              We’re looking for local people who care about our community to join the committee at
              Merriott Social Venue.
            </p>
            <p>
              This is a <strong>completely voluntary role</strong>, and there are no expectations
              beyond what you’re happy to contribute. Whether you want to simply attend meetings and
              share your thoughts, or occasionally get involved with events, every bit helps.
            </p>
            <p>
              The committee meets once a month to discuss the running of the club, explore new ideas,
              and help keep this important local space going strong.
            </p>
            <p>
              We host a wide range of community activities including street parties, bingo, quiz
              nights, and live music — and we’re always open to fresh ideas and new energy.
            </p>
            <p>
              You don’t need any special experience — just an interest in supporting your local venue
              and being part of something positive.
            </p>
            <p className="join-highlight">
              If you’ve ever thought <em>“I’d like to help out”</em> — this is your chance.
            </p>
          </div>

          <div className="join-action-card">
            <h2 className="section-title section-title--small">Get in touch</h2>
            <p>
              Send us an email or speak directly to a member of the team at the bar to find out more. Let’s keep Merriott Social Venue at the heart of our community!
            </p>
            
            <div className="join-actions">
              <a href={mailtoUrl} className="btn btn--primary btn--large btn--join-email">
                📧 Send us an email
              </a>
              <span className="join-or">or</span>
              <a href={`tel:+44${PHONE_NUMBER.replace(/\s+/g, '')}`} className="btn btn--ghost btn--large">
                📞 Call: {PHONE_NUMBER}
              </a>
            </div>

            <div className="join-details-list">
              <p>
                <strong>Email:</strong> <a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a>
              </p>
              <p>
                <strong>Address:</strong> 71 Lower Street, Merriott, Somerset, TA16 5NP
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
