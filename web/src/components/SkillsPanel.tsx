import { useMemo, useState } from 'react';

import type { SkillItem } from '../types';

interface SkillsPanelProps {
  skills: SkillItem[];
  onSave: (settings: Record<string, { enabled: boolean; always: boolean | null }>) => void;
}

export function SkillsPanel({ skills, onSave }: SkillsPanelProps) {
  const [draft, setDraft] = useState<Record<string, { enabled: boolean; always: boolean | null }>>({});

  const merged = useMemo(() => {
    return skills.map((skill) => {
      const override = draft[skill.name];
      return {
        ...skill,
        enabled: override?.enabled ?? skill.enabled,
        always: override?.always ?? skill.always,
      };
    });
  }, [skills, draft]);

  function update(name: string, patch: Partial<{ enabled: boolean; always: boolean | null }>) {
    setDraft((prev) => {
      const current = prev[name] ?? {
        enabled: merged.find((skill) => skill.name === name)?.enabled ?? true,
        always: merged.find((skill) => skill.name === name)?.always ?? null,
      };
      return {
        ...prev,
        [name]: { ...current, ...patch },
      };
    });
  }

  return (
    <div className="panel-grid">
      <article className="panel card-lg">
        <div className="panel-head">
          <h3>Skill Control</h3>
          <button className="btn primary" onClick={() => onSave(draft)}>
            Save Settings
          </button>
        </div>
        <div className="skill-list">
          {merged.map((skill) => (
            <div key={skill.name} className="skill-row">
              <div>
                <strong>{skill.name}</strong>
                <p className="muted">{skill.description}</p>
                <small>{skill.path}</small>
              </div>
              <div className="skill-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={(e) => update(skill.name, { enabled: e.target.checked })}
                  />
                  enabled
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(skill.always)}
                    onChange={(e) => update(skill.name, { always: e.target.checked ? true : false })}
                  />
                  always load
                </label>
                <span className={skill.available ? 'badge ok' : 'badge err'}>{skill.available ? 'ready' : 'missing deps'}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
