export default function Story(props: any) {
  const locale = props?.params?.locale ?? "en";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Story</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>
      <p>NIVRAN is calm, clean, and minimalist — built for everyday wear.</p>
    </div>
  );
}
