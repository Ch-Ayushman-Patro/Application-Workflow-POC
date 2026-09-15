import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, CheckSquare, BarChart2 } from "lucide-react";

export default function Layout() {
  const location = useLocation();
  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Applications", path: "/applications", icon: FileText },
    { name: "Tasks", path: "/tasks", icon: CheckSquare },
    { name: "Analytics", path: "/analytics", icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">Workflow POC</h1>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 p-3 rounded-lg ${
                    location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm h-16 flex items-center px-6">
          <h2 className="text-xl font-semibold text-gray-800">
            {navItems.find((i) => i.path === location.pathname)?.name || "Application"}
          </h2>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

