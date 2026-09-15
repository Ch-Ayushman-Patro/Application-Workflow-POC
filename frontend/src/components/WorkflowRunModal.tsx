import { useState } from 'react';
import { runWorkflow } from '../services/api';
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
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WorkflowRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WorkflowRunModal({ isOpen, onClose, onSuccess }: WorkflowRunModalProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    applications_checked: number;
    tasks_created: number;
    tasks_already_existing: number;
    escalations_created: number;
  } | null>(null);

  const handleExecute = async () => {
    setRunning(true);
    try {
      const data = await runWorkflow();
      setResult(data);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    setResult(null);
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
            <p className="text-xs text-slate-500 font-normal">Deterministic rules-based evaluation & task orchestration</p>
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
              Go to Task Queue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExecute} loading={running} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Run Again
              </Button>
              <Button variant="primary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={running}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleExecute} 
              loading={running} 
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
            >
              Scan & Orchestrate Now
            </Button>
          </div>
        )
      }
    >
      {!result ? (
        <div className="space-y-4 py-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Automated Evaluation Rules</h4>
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

          <p className="text-xs text-slate-500">
            Clicking <strong>Scan & Orchestrate Now</strong> will inspect all active cases in the database, calculate age thresholds, dispatch new tasks, and record audit events.
          </p>
        </div>
      ) : (
        <div className="space-y-5 py-1">
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 text-emerald-900">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Workflow Scan Completed Successfully</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                All active applications were analyzed against pipeline SLA policies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Applications Analyzed</span>
                <Activity className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{result.applications_checked}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Total uncompleted cases</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>New Tasks Created</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600">{result.tasks_created}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Dispatched to work queues</div>
            </div>

            <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80">
              <div className="flex items-center justify-between text-xs text-rose-700 mb-1">
                <span>Escalations Triggered</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-700">{result.escalations_created}</div>
              <div className="text-[11px] text-rose-600 mt-0.5">Direct manager alerts</div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Tasks Maintained</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-700">{result.tasks_already_existing}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Prevented duplicate alerts</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
