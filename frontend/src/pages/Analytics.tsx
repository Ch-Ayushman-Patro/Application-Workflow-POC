import { useState, useEffect } from "react";
import { getAnalyticsSummary } from "../services/api";
import { AnalyticsSummary } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    getAnalyticsSummary().then(setSummary);
  }, []);

  if (!summary) return <div>Loading...</div>;

  const timeData = [
    { name: "Average Processing Time", hours: parseFloat(summary.avg_processing_time_hours.toFixed(2)) },
    { name: "Average Waiting Time", hours: parseFloat(summary.avg_waiting_time_hours.toFixed(2)) }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-xl font-bold mb-2">Workflow Insights</h3>
        <p className="text-gray-600">
          The current biggest bottleneck stage is <span className="font-bold text-red-600">{summary.bottleneck_stage}</span>,
          which has the highest aggregate waiting time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border h-80">
          <h3 className="text-lg font-bold mb-4">Time Breakdown (Hours)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
          <h3 className="text-lg font-bold mb-4">Summary Statistics</h3>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Total Applications</span>
            <span className="font-medium">{summary.total_applications}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Completed Applications</span>
            <span className="font-medium">{summary.completed_applications}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Total Escalations</span>
            <span className="font-medium text-red-600">{summary.total_escalations}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

