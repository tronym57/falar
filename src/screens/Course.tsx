import { a1Units, v1UnitCount } from '../units'

export default function Course() {
  return (
    <main className="screen">
      <h1>A1 course</h1>
      {a1Units.map(u => (
        <div key={u.n} className={'card' + (u.n >= v1UnitCount ? ' locked' : '')}>
          <h2>{u.n} · {u.title}</h2>
          <p className="muted">{u.n < v1UnitCount ? u.scene : 'Coming later'}</p>
          {u.n < v1UnitCount && <div className="progress"><div style={{ width: '0%' }} /></div>}
        </div>
      ))}
    </main>
  )
}
