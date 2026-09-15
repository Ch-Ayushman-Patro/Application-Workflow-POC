import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Layers, 
  CheckSquare, 
  BarChart3, 
  Play, 
  Bell, 
  ShieldCheck, 
  Search, 
  User, 
  ChevronRight,
  Workflow
} from "lucide-react";
import { WorkflowRunModal } from "./WorkflowRunModal";
import { getTasks } from "../services/api";

export default function Layout() {
  const location = useLocation();
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [openTasksCount, setOpenTasksCount] = useState<number>(0);

  const fetchQuickStats = () => {
    getTasks()
      .then(tasks => {
        setOpenTasksCount(tasks.filter(t => t.status === "OPEN").length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchQuickStats();
    const interval = setInterval(fetchQuickStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { 
      name: "Command Center", 
      path: "/", 
      icon: LayoutDashboard,
      description: "Pipeline pulse & urgent risks"
    },
    { 
      name: "Case Pipeline", 
      path: "/applications", 
      icon: Layers,
      description: "Lifecycle tracking & cases"
    },
    { 
      name: "Task Inbox", 
      path: "/tasks", 
      icon: CheckSquare,
      badge: openTasksCount > 0 ? openTasksCount : undefined,
      badgeVariant: "error" as const,
      description: "Actionable assignments & escalations"
    },
    { 
      name: "Process Intelligence", 
      path: "/analytics", 
      icon: BarChart3,
      description: "Bottlenecks & SLA timing"
    },
  ];

  const getPageTitle = () => {
    if (location.pathname === "/") return { title: "Command Center", subtitle: "Live operations & risk monitoring" };
    if (location.pathname.startsWith("/applications/")) return { title: "Case Workspace", subtitle: "Application details & workflow timeline" };
    if (location.pathname.startsWith("/applications")) return { title: "Case Pipeline", subtitle: "Monitor and triage cases through lifecycle stages" };
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

        {/* Action Trigger Card */}
        <div className="p-3.5 mx-3 mb-3 bg-gradient-to-br from-slate-900 to-indigo-950/40 rounded-2xl border border-indigo-900/30">
          <div className="flex items-center gap-2 mb-1.5">
            <Play className="w-3.5 h-3.5 text-indigo-400 fill-current" />
            <span className="text-xs font-semibold text-slate-200">Trigger Orchestration</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
            Scan unclaimed cases, evaluate SLAs, and trigger manager escalations.
          </p>
          <button
            onClick={() => setIsRunModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs hover:shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            Run Engine Scan
          </button>
        </div>

        {/* User Card */}
        <div className="p-3.5 border-t border-slate-900 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-semibold text-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">Operations Lead</div>
              <div className="text-[11px] text-slate-500 truncate">Admin / Supervisor</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between z-10 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>LendFoundry Workflow</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-700 font-medium">{pageMeta.title}</span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {pageMeta.title}
              </h1>
            </div>
          </div>

          {/* Right header actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 border border-slate-200/60 rounded-xl text-xs text-slate-500">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Type / to search cases or tasks</span>
            </div>

            <button 
              onClick={() => setIsRunModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current text-indigo-600" />
              <span>Run Engine</span>
            </button>

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

      {/* Global Workflow Engine Runner Modal */}
      <WorkflowRunModal 
        isOpen={isRunModalOpen} 
        onClose={() => setIsRunModalOpen(false)}
        onSuccess={() => {
          fetchQuickStats();
          // Trigger a window event so active pages can reload data smoothly
          window.dispatchEvent(new CustomEvent('workflow-run-completed'));
        }}
      />
    </div>
  );
}
