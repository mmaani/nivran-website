export default function Contact({ params }: { params: { locale: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Contact</h1>
      <p style={{ opacity: 0.7 }}>Locale: {params.locale}</p>
      <ul>
        <li>Email: support@nivran.com</li>
      </ul>
    </div>
  );
}
