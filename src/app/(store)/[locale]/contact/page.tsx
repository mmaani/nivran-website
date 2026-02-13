export default function Contact(props: any) {
  const locale = props?.params?.locale ?? "en";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Contact</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>
      <ul>
        <li>Email: support@nivran.com</li>
      </ul>
    </div>
  );
}
