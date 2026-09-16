import { useState } from 'react';
import { runWorkflow, simulateInflow } from '../services/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  PlusCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WorkflowRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WorkflowRunModal({ isOpen, onClose, onSuccess }: WorkflowRunModalProps) {
  const [running, setRunning] = useState(false);
  const [simulatedCases, setSimulatedCases] = useState<string[]>([]);
  const [result, setResult] = useState<{
    applications_checked: number;
    tasks_created: number;
    tasks_already_existing: number;
    escalations_created: number;
  } | null>(null);

  const notifyChange = () => {
    window.dispatchEvent(new CustomEvent('workflow-run-completed'));
    if (onSuccess) onSuccess();
  };

  const handleExecuteOnly = async () => {
    setRunning(true);
    setSimulatedCases([]);
    try {
      const data = await runWorkflow();
      setResult(data);
      notifyChange();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleSimulateAndRun = async () => {
    setRunning(true);
    try {
      const response = await simulateInflow(3, true);
      setSimulatedCases(response.application_numbers || []);
      setResult(response.workflow_stats);
      notifyChange();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setSimulatedCases([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Run Workflow Engine</h3>
            <p className="text-xs text-slate-500 font-normal">Evaluate SLA rules or simulate incoming applications</p>
          </div>
        </div>
      }
      footer={
        result ? (
          <div className="w-full flex items-center justify-between">
            <Link 
              to="/tasks" 
              onClick={handleClose}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Go to Task Inbox <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSimulateAndRun} 
                loading={running} 
                icon={<PlusCircle className="w-3.5 h-3.5 text-indigo-600" />}
              >
                Simulate More Cases
              </Button>
              <Button variant="primary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={running}>
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExecuteOnly} 
                loading={running} 
                icon={<Play className="w-3.5 h-3.5" />}
              >
                Scan Current Cases Only
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleSimulateAndRun} 
                loading={running} 
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Simulate Inflow & Run (Demo)
              </Button>
            </div>
          </div>
        )
      }
    >
      {!result ? (
        <div className="space-y-4 py-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Automated SLA Rules</h4>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <strong className="text-slate-900">Unclaimed Stagnation:</strong> If OPEN & unclaimed for &gt; 24h, automatically generates an <em>Assignment</em> task for the Admin role.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                <div>
                  <strong className="text-slate-900">Review SLA Warning:</strong> If CLAIMED for &gt; 24h, assigns a <em>Follow-Up</em> task to the current owner.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <strong className="text-slate-900">Critical Escalation:</strong> If CLAIMED for &gt; 48h, triggers a high-priority <em>Escalation</em> to the user's manager / Admin.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-indigo-950">Demo Inflow Simulation:</strong>
              <p className="text-indigo-800/80 mt-0.5">
                Click <strong>"Simulate Inflow & Run"</strong> to generate 3 new randomized applications with varying SLA ages (unclaimed, active review, overdue) and immediately trigger matching tasks and escalations.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-1">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 text-emerald-900">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Workflow Scan Completed</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                {simulatedCases.length > 0 
                  ? `Injected ${simulatedCases.length} new cases (${simulatedCases.join(', ')}) and evaluated SLA rules.`
                  : 'All active applications evaluated against pipeline SLA rules.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Applications Checked</span>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{result.applications_checked}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Active cases in pipeline</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>New Tasks Created</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600">{result.tasks_created}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Dispatched to workbox</div>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80">
              <div className="flex items-center justify-between text-xs text-rose-700 mb-1">
                <span>Escalations Created</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-700">{result.escalations_created}</div>
              <div className="text-[11px] text-rose-600 mt-0.5">Manager level alerts</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Existing Maintained</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-700">{result.tasks_already_existing}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Duplicate prevention</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
