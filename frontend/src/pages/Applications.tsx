import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getApplications } from "../services/api";
import { Application } from "../types";
import { formatDistanceToNow } from "date-fns";

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    getApplications().then(setApps);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App #</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Tasks</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {apps.map((app) => (
            <tr key={app.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link to={`/applications/${app.id}`} className="text-blue-600 hover:underline font-medium">
                  {app.application_number}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  app.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  app.status === 'CLAIMED' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {app.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {app.current_role || "Unassigned"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDistanceToNow(new Date(app.created_at))}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-medium">
                {app.tasks?.filter(t => t.status === "OPEN").length || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

