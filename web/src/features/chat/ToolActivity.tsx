import type { ToolActivityStep } from '../../types';

interface ToolActivityProps {
  steps: ToolActivityStep[];
}

function stringifyArgs(args: unknown): string {
  if (!args) {
    return '';
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function ToolActivity({ steps }: ToolActivityProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="tool-activity" aria-label="Tool activity">
      {steps.map((step) => (
        <div key={step.id} className="tool-step">
          <div className="tool-step-head">
            <strong>{step.name}</strong>
            <span className={step.status === 'running' ? 'chip chip-progress' : step.ok ? 'chip chip-ok' : 'chip chip-warn'}>
              {step.status === 'running' ? 'Running' : step.ok === false ? 'Failed' : 'Done'}
            </span>
          </div>
          {step.args ? <pre className="tool-args">{stringifyArgs(step.args)}</pre> : null}
          {step.resultPreview ? <p className="tool-result">{step.resultPreview}</p> : null}
        </div>
      ))}
    </div>
  );
}
