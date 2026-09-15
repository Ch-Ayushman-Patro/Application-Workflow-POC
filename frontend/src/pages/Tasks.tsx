import { useState, useEffect } from "react";
import { getTasks, completeTask } from "../services/api";
import { Task } from "../types";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = () => {
    getTasks().then(setTasks);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleComplete = async (id: number) => {
    await completeTask(id);
    loadTasks();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">App ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tasks.map((task) => (
            <tr key={task.id} className={task.status === "COMPLETED" ? "bg-gray-50 opacity-60" : ""}>
              <td className="px-6 py-4 whitespace-nowrap">
                <Link to={`/applications/${task.application_id}`} className="text-blue-600 hover:underline">
                  View App
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  task.task_type === 'ESCALATION' ? 'bg-red-100 text-red-800' :
                  task.task_type === 'FOLLOW_UP' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {task.task_type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.title}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.assigned_to_role}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(task.created_at), 'PPp')}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {task.status === "OPEN" ? (
                  <button 
                    onClick={() => handleComplete(task.id)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Complete
                  </button>
                ) : (
                  <span className="text-green-600">Done</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

