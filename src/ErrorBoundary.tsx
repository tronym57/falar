import { Component, type ReactNode } from 'react'

/** If a screen crashes, show a clear error with a way out instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="screen">
        <h1>Something went wrong</h1>
        <div className="card error-card">
          <p>This screen hit an error. Your saved progress is not affected.</p>
          <p className="muted">{this.state.error.message}</p>
        </div>
        <button className="btn" onClick={() => location.reload()}>Reload app</button>
      </main>
    )
  }
}
