import { Link } from 'react-router-dom'

function NotFoundPage() { return <main className="workspace not-found"><p className="eyebrow">404 / Unknown frequency</p><h1>Feature not found.</h1><p>This route is outside the current project spectrum.</p><Link className="process-button" to="/">Return to all features →</Link></main> }

export default NotFoundPage
