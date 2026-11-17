export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl bg-white px-6 py-8 print:p-0">{children}</div>;
}
