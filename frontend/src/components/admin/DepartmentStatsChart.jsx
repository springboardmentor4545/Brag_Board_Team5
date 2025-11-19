export default function DepartmentStatsChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400">No department data available.</p>;
  }

  const maxShoutouts = Math.max(...data.map(d => d.shoutout_count), 0);

  return (
    <div className="space-y-4">
      {data.map((dept) => {
        const pct = maxShoutouts > 0 ? (dept.shoutout_count / maxShoutouts) * 100 : 0;
        return (
          <div key={dept.department} className="flex items-center">
            <div className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">{dept.department}</div>
            <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
              <div
                className="bg-blue-600 h-6 rounded-full text-white text-xs flex items-center justify-center transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              >
                {dept.shoutout_count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
