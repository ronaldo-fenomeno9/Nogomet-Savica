import Nav from '@/components/Nav'

export default function AppLayout({ children }) {
  return (
    <>
      <Nav />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 16 }}>
        {children}
      </div>
    </>
  )
}
