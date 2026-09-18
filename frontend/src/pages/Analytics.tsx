import { useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  Activity, AlertTriangle, Users, TrendingUp, AlertCircle, CheckCircle2, 
  RotateCw, ArrowRight, ShieldAlert, ExternalLink, Timer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '../context/RoleContext';
import { 
  useAnalyticsOverview, 
  useAnalyticsTime, 
  useAnalyticsSla, 
  useAnalyticsWorkload, 
  useAnalyticsTrends, 
  useAnalyticsInsights 
} from '../hooks/useWorkflowQueries';
import { formatDuration } from '../utils/formatDuration';

// --- Reusable State Wrapper Component ---
interface StateWrapperProps {
  loading: boolean;
  error: boolean;
  hasData: boolean;
  errorMessage: string;
  emptyMessage: string;
  children: React.ReactNode;
  minHeight?: string;
}

function DataStateWrapper({ 
  loading, 
  error, 
  hasData, 
  errorMessage, 
  emptyMessage, 
  children,
  minHeight = "min-h-[160px]"
}: StateWrapperProps) {
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${minHeight} text-slate-400 py-8`}>
        <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading operational data...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${minHeight} text-rose-600 py-8`}>
        <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
        <p className="text-sm font-medium">{errorMessage}</p>
        <p className="text-xs text-slate-400 mt-1">Please try refreshing the page or checking server logs.</p>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${minHeight} text-slate-400 py-8`}>
        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
          <Activity className="w-5 h-5 text-slate-300" />
        </div>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function Analytics() {
  const { currentRole } = useRole();
  const isAdmin = currentRole === 'Admin';
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  // Analytics endpoints queried conditionally ONLY for Admin
  const { data: overview, isLoading: loadingOverview, isError: _errOverview } = useAnalyticsOverview({ enabled: isAdmin });
  const { data: time, isLoading: loadingTime, isError: _errTime } = useAnalyticsTime({ enabled: isAdmin });
  const { data: sla, isLoading: loadingSla, isError: errSla } = useAnalyticsSla({ enabled: isAdmin });
  const { data: workload, isLoading: loadingWorkload, isError: errWorkload } = useAnalyticsWorkload({ enabled: isAdmin });
  const { data: trends, isLoading: loadingTrends, isError: errTrends } = useAnalyticsTrends({ enabled: isAdmin });
  const { data: insights, isLoading: loadingInsights, isError: errInsights } = useAnalyticsInsights({ enabled: isAdmin });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    setLastRefreshedAt(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Restrict access for non-admin roles without querying APIs
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
          Process Intelligence is an executive operational workspace restricted to Administrators.
        </p>
        <div className="mt-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Return to Command Center
          </Link>
        </div>
      </div>
    );
  }

  // Derived time values
  const avgLifecycleFormatted = formatDuration(time?.avg_total_elapsed_hours);
  const avgQueueFormatted = formatDuration(time?.avg_queue_wait_hours);
  const avgReviewFormatted = formatDuration(time?.avg_review_duration_hours);
  const flowEfficiency = time?.active_review_percentage ? Math.round(time.active_review_percentage) : 0;
  const waitingPercent = time?.queue_waiting_percentage ? Math.round(time.queue_waiting_percentage) : 0;

  // Bottleneck values
  const bottleneckStage = insights?.primary_bottleneck?.stage || "Underwriting Review";
  const bottleneckAffected = insights?.primary_bottleneck?.affected_count ?? (sla?.escalated_count ?? 0);
  const bottleneckUrl = insights?.primary_bottleneck?.target_url || "/applications?tab=delayed";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflow Performance Overview</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs text-slate-400 font-mono">
            Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-colors disabled:opacity-60"
            title="Refresh operational metrics"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* SECTION 1 — PROCESS HEALTH (Operational Strip) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span>Process Health Overview</span>
          <span className="text-[11px] font-normal text-slate-400">Deterministic operational benchmark</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* Average Lifecycle */}
          <div className="pt-2 md:pt-0 md:px-3 first:pl-0">
            <p className="text-xs font-medium text-slate-500">Avg Lifecycle Time</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tracking-tight">
              {loadingTime ? '...' : avgLifecycleFormatted}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">End-to-end average</p>
          </div>

          {/* Flow Efficiency */}
          <div className="pt-2 md:pt-0 md:px-3">
            <p className="text-xs font-medium text-slate-500">Flow Efficiency</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-slate-900">{loadingTime ? '...' : `${flowEfficiency}%`}</span>
              <span className="text-[11px] text-emerald-600 font-medium">active review</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Active Review / Total</p>
          </div>

          {/* Waiting Time % */}
          <div className="pt-2 md:pt-0 md:px-3">
            <p className="text-xs font-medium text-slate-500">Waiting Time %</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-slate-900">{loadingTime ? '...' : `${waitingPercent}%`}</span>
              <span className="text-[11px] text-amber-600 font-medium">in queue</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Queue Wait / Total</p>
          </div>

          {/* Delayed Applications */}
          <div className="pt-2 md:pt-0 md:px-3">
            <p className="text-xs font-medium text-slate-500">Delayed Applications</p>
            <Link 
              to="/applications?tab=delayed" 
              className="group flex items-baseline gap-2 mt-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-xl font-bold text-amber-600">
                {loadingOverview ? '...' : overview?.delayed_applications ?? 0}
              </span>
              <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium group-hover:underline inline-flex items-center gap-0.5">
                Investigate &rarr;
              </span>
            </Link>
            <p className="text-[11px] text-slate-400 mt-0.5">Past 24h SLA target</p>
          </div>

          {/* Escalated Applications */}
          <div className="pt-2 md:pt-0 md:px-3">
            <p className="text-xs font-medium text-slate-500">Escalated Applications</p>
            <Link 
              to="/applications?tab=escalated" 
              className="group flex items-baseline gap-2 mt-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-xl font-bold text-rose-600">
                {loadingOverview ? '...' : overview?.escalated_applications ?? 0}
              </span>
              <span className="text-[11px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-medium group-hover:underline inline-flex items-center gap-0.5">
                Critical &rarr;
              </span>
            </Link>
            <p className="text-[11px] text-slate-400 mt-0.5">Past 48h critical threshold</p>
          </div>

          {/* Active Applications */}
          <div className="pt-2 md:pt-0 md:px-3">
            <p className="text-xs font-medium text-slate-500">Active Applications</p>
            <p className="text-xl font-bold text-slate-900 mt-1 tracking-tight">
              {loadingOverview ? '...' : overview?.active_applications ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Currently in flight</p>
          </div>

        </div>
      </div>

      {/* SECTION 2 & 3 — PRIMARY BOTTLENECK & WHERE TIME IS BEING LOST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SECTION 3: Primary Bottleneck Callout (Left Column - 5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-linear-to-br from-rose-50/70 via-white to-white rounded-2xl border-2 border-rose-200/90 shadow-sm p-6 flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-rose-100/50 rounded-full blur-2xl pointer-events-none" />
            
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-semibold text-xs tracking-wider uppercase mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Primary Bottleneck</span>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                {loadingInsights ? "Analyzing workflow..." : bottleneckStage}
              </h3>

              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {insights?.primary_bottleneck?.evidence || "Review processing is contributing the largest observed delay across the application pipeline."}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-rose-100/80">
                <div className="bg-white/80 rounded-xl p-3 border border-rose-100 shadow-2xs">
                  <p className="text-xs text-slate-500">Affected Applications</p>
                  <p className="text-lg font-bold text-rose-600 mt-0.5">
                    {loadingInsights ? '...' : `${bottleneckAffected} applications`}
                  </p>
                </div>
                <div className="bg-white/80 rounded-xl p-3 border border-rose-100 shadow-2xs">
                  <p className="text-xs text-slate-500">Average Duration</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {loadingTime ? '...' : (bottleneckStage === "Assignment Queue" ? avgQueueFormatted : avgReviewFormatted)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-rose-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Requires operational rebalancing</span>
              <Link 
                to={bottleneckUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all hover:gap-2"
              >
                <span>View Affected Applications</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* SECTION 2: Where Is Application Time Being Lost? (Right Column - 7 cols) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Where Is Application Time Being Lost?
                </h3>
                <span className="text-xs text-slate-400 font-medium">Stage-level delay distribution</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Comparative analysis of time accumulation across primary workflow stages.
              </p>

              {/* Process Stages Comparison Visualization */}
              <div className="space-y-5">
                
                {/* Stage 1: Assignment Queue */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-sm font-semibold text-slate-900">Assignment Queue</span>
                      <span className="text-xs text-slate-500">(Claim Intake & Assignment)</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">
                      Avg Wait: <span className="text-amber-700 font-bold">{loadingTime ? '...' : avgQueueFormatted}</span>
                    </span>
                  </div>

                  {/* Visual Proportion Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden mb-2">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, waitingPercent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong className="text-slate-800">{sla?.assignment_delayed_count ?? 0}</strong> unassigned beyond 24h SLA
                    </span>
                    <span>{waitingPercent}% of total lifecycle time</span>
                  </div>
                </div>

                {/* Stage 2: Underwriting Review */}
                <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <span className="text-sm font-semibold text-slate-900">Underwriting Review</span>
                      <span className="text-xs text-slate-500">(Active Case Decisioning)</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">
                      Avg Review: <span className="text-indigo-700 font-bold">{loadingTime ? '...' : avgReviewFormatted}</span>
                    </span>
                  </div>

                  {/* Visual Proportion Bar */}
                  <div className="w-full bg-indigo-200/60 rounded-full h-2.5 overflow-hidden mb-2">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, flowEfficiency))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      <strong className="text-rose-700">{sla?.escalated_count ?? 0}</strong> critical escalated (&gt;48h)
                    </span>
                    <span>{flowEfficiency}% of total lifecycle time</span>
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>SLA Baseline: 24h Assignment • 24h Review • 48h Escalation</span>
              <span className="font-medium text-slate-600">Review stage dominates accumulated duration</span>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 4 — WAITING VS ACTIVE REVIEW (Time Decomposition) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-600" />
              <span>Time Decomposition: Queue Waiting vs Active Review</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Lifecycle Time = Queue Waiting Time + Review Duration
            </p>
          </div>
          <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 self-start">
            Total Average: <span className="font-bold text-slate-900">{avgLifecycleFormatted}</span>
          </div>
        </div>

        {/* Dual Stacked Composition Bar */}
        <div className="my-5">
          <div className="w-full h-6 rounded-xl bg-slate-100 overflow-hidden flex shadow-inner">
            <div 
              className="bg-amber-500 h-full flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500"
              style={{ width: `${Math.max(10, Math.min(90, waitingPercent))}%` }}
              title={`Queue Waiting Time: ${waitingPercent}% (${avgQueueFormatted})`}
            >
              {waitingPercent}%
            </div>
            <div 
              className="bg-indigo-600 h-full flex items-center justify-center text-[11px] font-bold text-white transition-all duration-500"
              style={{ width: `${Math.max(10, Math.min(90, flowEfficiency))}%` }}
              title={`Active Review Time: ${flowEfficiency}% (${avgReviewFormatted})`}
            >
              {flowEfficiency}%
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-3.5 rounded-xl border border-amber-200/60 bg-amber-50/40 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  <span className="text-xs font-semibold text-slate-800">Queue Waiting Time</span>
                </div>
                <p className="text-lg font-bold text-amber-900 mt-1">{avgQueueFormatted}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Time before an underwriter claims or receives the application.</p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-white px-2 py-1 rounded-md border border-amber-200 shadow-2xs">
                {waitingPercent}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-indigo-200/60 bg-indigo-50/40 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-600" />
                  <span className="text-xs font-semibold text-slate-800">Active Review Time</span>
                </div>
                <p className="text-lg font-bold text-indigo-900 mt-1">{avgReviewFormatted}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Duration application is actively being investigated by an underwriter.</p>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-md border border-indigo-200 shadow-2xs">
                {flowEfficiency}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5 — DELAY EXPOSURE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Delay Exposure
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current volume of applications by distinct operational delay classification.
            </p>
          </div>
          <span className="text-xs text-slate-400">Strict SLA cohort breakdown</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Assignment Delayed */}
          <Link 
            to="/applications?tab=assignment_delayed" 
            className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/70 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800">Assignment Delayed</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-extrabold text-amber-900 mt-2">
              {sla?.assignment_delayed_count ?? 0}
            </p>
            <p className="text-xs text-slate-600 mt-1 font-medium">Unassigned &gt; 24h SLA</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting intake claiming</p>
          </Link>

          {/* Review Delayed */}
          <Link 
            to="/applications?tab=delayed" 
            className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 hover:bg-amber-50/70 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800">Review Delayed</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-extrabold text-amber-900 mt-2">
              {sla?.review_delayed_count ?? 0}
            </p>
            <p className="text-xs text-slate-600 mt-1 font-medium">In review 24h – 48h</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Past initial review SLA</p>
          </Link>

          {/* Critical Escalated */}
          <Link 
            to="/applications?tab=escalated" 
            className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800">Critical Escalated</span>
              <ExternalLink className="w-3.5 h-3.5 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-extrabold text-rose-900 mt-2">
              {sla?.escalated_count ?? 0}
            </p>
            <p className="text-xs text-rose-700 mt-1 font-medium">In review &gt; 48h critical</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Breached critical SLA threshold</p>
          </Link>

          {/* Total Escalated */}
          <Link 
            to="/applications?tab=escalated" 
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Total Escalated</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              {overview?.escalated_applications ?? 0}
            </p>
            <p className="text-xs text-slate-600 mt-1 font-medium">Pipeline-wide escalations</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Requires manager intervention</p>
          </Link>

        </div>
      </div>

      {/* SECTION 6 — APPLICATIONS DRIVING DELAY (Investigation Table) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Applications Driving Delay</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked by accumulated delay beyond SLA target. Never exposes internal database IDs.
            </p>
          </div>
          <Link 
            to="/applications?tab=delayed" 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            <span>View All Delayed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <DataStateWrapper
            loading={loadingSla}
            error={errSla}
            hasData={Boolean(sla?.delay_contributors && sla.delay_contributors.length > 0)}
            errorMessage="Unable to load delay contributors."
            emptyMessage="No delayed applications found. Operational flow is within SLA targets."
          >
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Application</th>
                  <th className="px-6 py-3.5">Stage</th>
                  <th className="px-6 py-3.5">Underwriter</th>
                  <th className="px-6 py-3.5">Elapsed Time</th>
                  <th className="px-6 py-3.5">Delay (Beyond SLA)</th>
                  <th className="px-6 py-3.5">State</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sla?.delay_contributors?.map((item) => (
                  <tr key={item.application_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-indigo-600">
                      <Link 
                        to={`/applications/${item.application_id}`}
                        className="hover:underline flex items-center gap-1"
                        title={`Open workspace for ${item.application_number}`}
                      >
                        {item.application_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {item.stage}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.underwriter ? (
                        <span className="font-medium text-slate-800">{item.underwriter}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium font-mono text-xs">
                      {formatDuration(item.elapsed_time_hours)}
                    </td>
                    <td className="px-6 py-4 text-rose-600 font-bold font-mono text-xs">
                      +{formatDuration(item.sla_excess_hours)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.sla_state === 'ESCALATED' 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {item.sla_state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/applications/${item.application_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataStateWrapper>
        </div>
      </div>

      {/* SECTION 7 — UNDERWRITER WORKLOAD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <span>Underwriter Workload</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current active application capacity and delay distribution by underwriter.
            </p>
          </div>
          <span className="text-xs text-slate-400">Operational visibility • No employee ranking</span>
        </div>

        <div className="overflow-x-auto">
          <DataStateWrapper
            loading={loadingWorkload}
            error={errWorkload}
            hasData={Boolean(workload?.underwriters && workload.underwriters.length > 0)}
            errorMessage="Unable to load workload data."
            emptyMessage="No underwriter workload data available."
          >
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Underwriter</th>
                  <th className="px-6 py-3.5">Active</th>
                  <th className="px-6 py-3.5">Delayed</th>
                  <th className="px-6 py-3.5">Escalated</th>
                  <th className="px-6 py-3.5">Avg Review Time</th>
                  <th className="px-6 py-3.5">Oldest Active</th>
                  <th className="px-6 py-3.5 text-right">View Workload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workload?.underwriters?.map((uw) => (
                  <tr key={uw.user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {uw.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">
                        {uw.active_applications}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {uw.delayed_applications > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {uw.delayed_applications} delayed
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {uw.escalated_applications > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {uw.escalated_applications} escalated
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-xs">
                      {formatDuration(uw.avg_review_hours)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-xs">
                      {uw.oldest_active_review_hours ? formatDuration(uw.oldest_active_review_hours) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/applications?underwriter=${encodeURIComponent(uw.name)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-900 hover:underline"
                      >
                        <span>Filter Cases</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataStateWrapper>
        </div>
      </div>

      {/* SECTION 8 — PROCESS TRENDS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Process Trends (Past 7 Days)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological operational velocity and intake versus completion volume.
            </p>
          </div>
          <span className="text-xs text-slate-400">Oldest &rarr; Newest</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Chart A: Application Flow */}
          <div className="flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Application Inflow vs Outcomes
            </h4>
            <div className="h-70 w-full">
              <DataStateWrapper
                loading={loadingTrends}
                error={errTrends}
                hasData={Boolean(trends?.data && trends.data.length > 0)}
                errorMessage="Unable to load trend data."
                emptyMessage="No historical trend data available for the selected period."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends?.data || []} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#64748b" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </DataStateWrapper>
            </div>
          </div>

          {/* Chart B: Processing Duration Velocity */}
          <div className="flex flex-col">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Processing Duration Velocity (Hours)
            </h4>
            <div className="h-70 w-full">
              <DataStateWrapper
                loading={loadingTrends}
                error={errTrends}
                hasData={Boolean(trends?.data && trends.data.length > 0)}
                errorMessage="Unable to load time trend data."
                emptyMessage="No historical time data available for the selected period."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends?.data || []} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#64748b' }} 
                      unit="h" 
                      tickFormatter={(val) => `${Math.round(val)}h`}
                    />
                    <RechartsTooltip 
                      formatter={(val: unknown) => [typeof val === 'number' ? formatDuration(val) : String(val), '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="avg_queue_wait_hours" name="Avg Queue Wait" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="avg_review_hours" name="Avg Review Duration" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </DataStateWrapper>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 9 — OPERATIONAL INSIGHTS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Operational Insights & Findings</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic, evidence-backed findings derived from measurable application timestamps.
            </p>
          </div>
          <span className="text-xs text-slate-400">Automated diagnosis</span>
        </div>

        <DataStateWrapper
          loading={loadingInsights}
          error={errInsights}
          hasData={Boolean(insights?.insights && insights.insights.length > 0)}
          errorMessage="Unable to load operational insights."
          emptyMessage="No operational anomalies or SLA breaches identified."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights?.insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  insight.severity === 'HIGH' 
                    ? 'bg-rose-50/40 border-rose-200' 
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      insight.severity === 'HIGH' 
                        ? 'bg-rose-100 text-rose-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {insight.severity === 'HIGH' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {insight.severity} ATTENTION
                    </span>
                    {insight.affected_count !== undefined && (
                      <span className="text-xs font-semibold text-slate-600">
                        {insight.affected_count} affected
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {insight.message}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {insight.evidence}
                  </p>
                </div>

                {insight.target_url && (
                  <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-end">
                    <Link 
                      to={insight.target_url} 
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      <span>Investigate cohort</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DataStateWrapper>
      </div>

    </div>
  );
}
