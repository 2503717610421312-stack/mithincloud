import "./globals.css";

export const metadata = {
  title: "QP/Sec | Secure Examination Operations",
  description: "MFA-gated, encrypted question-paper workflow with copy traceability and audit logging.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}