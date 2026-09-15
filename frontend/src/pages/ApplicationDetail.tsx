import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getApplication, getTimeline, claimApplication, completeApplication, getUsers } from "../services/api";
import { Application, ApplicationEvent, User } from "../types";
import { format } from "date-fns";

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<ApplicationEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");

  const loadData = () => {
    if (!id) return;
    getApplication(Number(id)).then(setApp);
    getTimeline(Number(id)).then(setTimeline);
  };

  useEffect(() => {
    loadData();
    getUsers().then(u => {
        setUsers(u);
        if (u.length > 0) setSelectedUser(u[0].id.toString());
    });
  }, [id]);

  if (!app) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold">{app.application_number}</h2>
              <p className="text-gray-500 mt-1">Status: {app.status}</p>
            </div>
            <div className="space-x-2 flex">
              {app.status === 'OPEN' && (
                <div className="flex space-x-2">
                  <select 
                    className="border rounded p-2"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                  <button 
                    onClick={() => claimApplication(app.id, Number(selectedUser)).then(loadData)}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    Claim
                  </button>
                </div>
              )}
              {app.status === 'CLAIMED' && (
                <button 
                  onClick={() => completeApplication(app.id).then(loadData)}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Complete Application
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Created At</span>
              <span className="font-medium">{format(new Date(app.created_at), 'PPp')}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Claimed By</span>
              <span className="font-medium">{app.current_role || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-bold mb-4">Open Tasks</h3>
          {app.tasks.filter(t => t.status === "OPEN").length === 0 ? (
            <p className="text-gray-500">No open tasks.</p>
          ) : (
            <ul className="space-y-3">
              {app.tasks.filter(t => t.status === "OPEN").map(task => (
                <li key={task.id} className="p-3 border rounded border-red-200 bg-red-50">
                  <div className="font-medium text-red-800">{task.task_type}</div>
                  <div className="text-sm text-red-600">{task.title} - Assigned to: {task.assigned_to_role || 'Any'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-bold mb-4">Timeline</h3>
        <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
          {timeline.map((event, idx) => (
            <div key={idx} className="relative pl-6">
              <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5"></div>
              <div className="text-sm font-medium">{event.event_type.replace('_', ' ')}</div>
              <div className="text-xs text-gray-500">{format(new Date(event.timestamp), 'PPp')}</div>
              {event.details && <div className="text-sm mt-1 text-gray-600">{event.details}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

