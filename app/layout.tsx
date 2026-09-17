import "./globals.css";

export const metadata = {
  title: "Secure Question Paper Portal",
  description: "MicroProject implementation for secure question-paper management",
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