import { useState, useMemo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Layers, 
  CheckSquare, 
  BarChart3, 
  Bell, 
  ShieldCheck, 
  ChevronRight,
  ChevronDown,
  Workflow
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useUserScope } from "../hooks/useUserScope";

export default function Layout() {
  const location = useLocation();
  const { currentUser, currentRole, allUsers, setCurrentUser } = useRole();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Derived user-scoped tasks from shared server cache
  const scope = useUserScope();

  const openTasksCount = useMemo(() => {
    if (currentRole === "Admin") {
      return scope.adminActionTasks.length;
    } else if (currentRole === "Underwriter") {
      return scope.myTasks.length;
    } else if (currentRole === "Manager") {
      return scope.myTasks.length + scope.myEscalations.length;
    }
    return 0;
  }, [scope.adminActionTasks.length, scope.myTasks.length, scope.myEscalations.length, currentRole]);

  const allNavItems = [
    { 
      name: "Command Center", 
      path: "/", 
      icon: LayoutDashboard,
      description: "Pipeline pulse & urgent risks",
      adminOnly: false,
    },
    { 
      name: "Application Pipeline", 
      path: "/applications", 
      icon: Layers,
      description: "Lifecycle tracking & Applications",
      adminOnly: false,
    },
    { 
      name: "Task Inbox", 
      path: "/tasks", 
      icon: CheckSquare,
      badge: openTasksCount > 0 ? openTasksCount : undefined,
      badgeVariant: "error" as const,
      description: "Actionable assignments & escalations",
      adminOnly: false,
    },
    { 
      name: "Process Intelligence", 
      path: "/analytics", 
      icon: BarChart3,
      description: "Bottlenecks & SLA timing",
      adminOnly: true,
    },
  ];

  // Process Intelligence is only accessible to Admin
  const navItems = allNavItems.filter(item => !item.adminOnly || currentRole === "Admin");

  const getPageTitle = () => {
    if (location.pathname === "/") return { title: "Command Center", subtitle: "Live operations & risk monitoring" };
    if (location.pathname.startsWith("/applications/")) return { title: "Application Workspace", subtitle: "Application details & workflow timeline" };
    if (location.pathname.startsWith("/applications")) return { title: "Application Pipeline", subtitle: "Monitor and triage Applications through lifecycle stages" };
    if (location.pathname.startsWith("/tasks")) return { title: "Operational Inbox", subtitle: "Triage assignments, follow-ups, and escalations" };
    if (location.pathname.startsWith("/analytics")) return { title: "Process Intelligence", subtitle: "Workflow velocity, waiting bottlenecks, and SLA health" };
    return { title: "Workflow Orchestrator", subtitle: "Application Monitoring POC" };
  };

  const pageMeta = getPageTitle();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-68 bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-900 select-none z-20">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">FlowPulse</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">POC</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Workflow Monitoring</p>
            </div>
          </Link>
        </div>

        {/* Engine Status Banner */}
        <div className="px-4 pt-4 pb-2">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-300">Rules Engine Active</span>
            </div>
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Operations
          </div>
          {navItems.map((item) => {
            const isActive = item.path === "/" 
              ? location.pathname === "/" 
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4.5 h-4.5 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white text-indigo-700" : "bg-rose-500 text-white animate-pulse"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Role Simulation Switcher (DEMO ONLY) */}
        <div className="p-3.5 border-t border-slate-900 bg-slate-950 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">User</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  currentRole === "Admin" ? "bg-purple-600/20 text-purple-400 border border-purple-500/30" :
                  currentRole === "Manager" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" :
                  "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                }`}>
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">Role: {currentRole}</div>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] text-slate-400 font-medium border-b border-slate-800/80 mb-1 flex items-center justify-between">
                  <span>Switch User Persona:</span>
                  <span className="text-[9px] text-slate-500">(Demo only)</span>
                </div>
                {allUsers.map((u) => {
                  const isSelected = u.id === currentUser.id;
                  const roleBadgeClass = 
                    u.role === "Admin" ? "text-purple-400" :
                    u.role === "Manager" ? "text-blue-400" :
                    "text-emerald-400";
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setCurrentUser(u);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-medium truncate">{u.name}</span>
                        <span className={`text-[10px] ${isSelected ? "text-indigo-200" : roleBadgeClass}`}>
                          {u.role}
                        </span>
                      </div>
                      {isSelected && <span className="text-[11px] font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between z-10 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          {/* Right header actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/tasks"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="Notifications & Tasks"
            >
              <Bell className="w-4.5 h-4.5" />
              {openTasksCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
              )}
            </Link>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-7xl mx-auto pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
