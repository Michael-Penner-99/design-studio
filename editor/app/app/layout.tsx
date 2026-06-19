export const metadata = {
  title: "Action Studio — Site Editor",
  description: "Operator and client editor for Action Studio sites.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
