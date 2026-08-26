import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, Brain, HelpCircle, FileSearch, CalendarDays, 
  Code2, ShieldCheck, UserCheck, GitPullRequest, CheckCircle2 
} from 'lucide-react';

const ICONS = {
  intake: Inbox,
  understanding: Brain,
  clarification: HelpCircle,
  context: FileSearch,
  planning: CalendarDays,
  coding: Code2,
  validation: ShieldCheck,
  reviewer: UserCheck,
  pr: GitPullRequest,
  review: CheckCircle2
};

function PipelineNode({ stage, isActive, isExpanded, onToggle, isBranch }) {
  const Icon = ICONS[stage.id] || CheckCircle2;
  
  // Visual states based on status
  const isPending = stage.status === 'pending';
  const isRunning = stage.status === 'running';
  const isComplete = stage.status === 'complete';
  const isFailed = stage.status === 'failed';
  const isSkipped = stage.status === 'skipped';
  
  let borderColor = 'border-white/10';
  let bgColor = 'bg-white/5';
  let iconColor = 'text-white/40';
  
  if (isRunning) {
    borderColor = 'border-indigo-500/50';
    bgColor = 'bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]';
    iconColor = 'text-indigo-400';
  } else if (isComplete) {
    borderColor = 'border-emerald-500/30';
    bgColor = 'bg-emerald-500/10';
    iconColor = 'text-emerald-400';
  } else if (isFailed) {
    borderColor = 'border-red-500/50';
    bgColor = 'bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
    iconColor = 'text-red-400';
  } else if (isSkipped) {
    borderColor = 'border-white/5 border-dashed';
    bgColor = 'bg-transparent';
    iconColor = 'text-white/20';
  }

  return (
    <motion.div 
      layout
      onClick={onToggle}
      className={`relative rounded-xl border p-4 cursor-pointer backdrop-blur-md transition-colors w-48 ${borderColor} ${bgColor} ${isBranch ? 'translate-y-8' : ''}`}
      animate={{
        scale: isRunning ? 1.05 : 1,
        opacity: (isPending || isSkipped) ? 0.5 : 1
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{
            rotate: isRunning ? 360 : 0,
            scale: isRunning ? [1, 1.2, 1] : 1
          }}
          transition={{
            rotate: { duration: 4, repeat: Infinity, ease: "linear" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
          className={`p-2 rounded-lg bg-black/40 shrink-0 ${iconColor}`}
        >
          {isComplete ? <CheckCircle2 size={18} /> : <Icon size={18} />}
        </motion.div>
        
        <div className="min-w-0">
          <h4 className={`text-sm font-semibold tracking-wide truncate ${(isRunning || isComplete) ? 'text-white' : 'text-white/60'}`}>
            {stage.label}
          </h4>
          <p className="text-xs text-white/40 mt-0.5 capitalize truncate">
            {stage.error ? 'Failed' : stage.status}
          </p>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (stage.error || stage.status === 'running') && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-3 border-t border-white/10 text-xs font-mono text-white/50 break-words">
              {stage.error || (isRunning ? 'Processing...' : 'Complete')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PipelineConnector({ isActive, isComplete, isDashed }) {
  return (
    <div className="flex-1 h-px relative flex items-center min-w-[20px]">
      {/* Base track */}
      <div className={`absolute inset-0 w-full h-px ${isDashed ? 'border-t border-dashed border-white/10' : 'bg-white/10'}`} />
      
      {/* Active pulse */}
      {(isActive || isComplete) && !isDashed && (
        <motion.div
          className="absolute h-px bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0 w-full"
          initial={isActive ? { x: "-100%" } : { x: "0%", opacity: isComplete ? 0.5 : 1 }}
          animate={isActive ? { x: "100%" } : { x: "0%", opacity: isComplete ? 0.5 : 1 }}
          transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "linear" } : {}}
        />
      )}
    </div>
  );
}

export default function PipelineVisualization({ ticket, token }) {
  const [run, setRun] = useState(ticket);
  const [expandedNode, setExpandedNode] = useState(null);

  // Poll for updates if the ticket is active
  useEffect(() => {
    if (!ticket || ticket.status === 'success' || ticket.status === 'error' || ticket.status === 'WAITING') return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/tickets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const tickets = await res.json();
          const updated = tickets.find(t => t.id === ticket.id);
          if (updated && updated.stages) {
            setRun(updated);
          }
        }
      } catch (e) {
        console.error("Failed to poll ticket status");
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [ticket, token]);

  if (!run?.stages) return null;

  return (
    <div className="w-full bg-black/20 rounded-2xl border border-white/5 p-8 my-6 overflow-x-auto scrollbar-hide">
      <div className="flex items-center min-w-max pb-8 pt-4">
        {run.stages.map((stage, index) => {
          const isLast = index === run.stages.length - 1;
          const isClarification = stage.id === 'clarification';
          
          return (
            <div key={stage.id} className="flex items-center">
              <PipelineNode 
                stage={stage}
                isBranch={isClarification}
                isActive={run.currentStage === stage.id}
                isExpanded={expandedNode === stage.id}
                onToggle={() => setExpandedNode(expandedNode === stage.id ? null : stage.id)}
              />
              
              {!isLast && (
                <div className="w-12 px-1 relative">
                  <PipelineConnector 
                    isActive={run.currentStage === stage.id}
                    isComplete={stage.status === 'complete' || stage.status === 'skipped'}
                    isDashed={isClarification || run.stages[index+1]?.id === 'clarification'}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
