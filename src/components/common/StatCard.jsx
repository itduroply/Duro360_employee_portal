// TailAdmin metric card (Analytics page): label, big value, optional icon.
export default function StatCard({ label, value, icon, valueClassName = 'text-gray-800' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
      {icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-800">{icon}</div>
      )}
      <p className="text-theme-sm text-gray-500">{label}</p>
      <h4 className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</h4>
    </div>
  );
}
