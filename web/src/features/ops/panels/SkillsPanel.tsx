import { useMemo, useState } from 'react';

import type { SkillItem } from '../../../types';

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
  }, [draft, skills]);

  function update(name: string, patch: Partial<{ enabled: boolean; always: boolean | null }>) {
    setDraft((current) => {
      const existing = current[name] ?? {
        enabled: merged.find((skill) => skill.name === name)?.enabled ?? true,
        always: merged.find((skill) => skill.name === name)?.always ?? null,
      };
      return {
        ...current,
        [name]: { ...existing, ...patch },
      };
    });
  }

  return (
    <section className="ops-panel">
      <header className="ops-panel-head">
        <h3>Skills</h3>
        <button className="glass-btn" onClick={() => onSave(draft)}>
          Save settings
        </button>
      </header>

      <div className="ops-list">
        {merged.map((skill) => (
          <div className="skill-card" key={skill.name}>
            <div>
              <strong>{skill.name}</strong>
              <p className="muted">{skill.description}</p>
              <p className="muted mono">{skill.path}</p>
            </div>
            <div className="inline-actions">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={skill.enabled}
                  onChange={(event) => update(skill.name, { enabled: event.target.checked })}
                />
                enabled
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(skill.always)}
                  onChange={(event) => update(skill.name, { always: event.target.checked ? true : false })}
                />
                always load
              </label>
              <span className={skill.available ? 'chip chip-ok' : 'chip chip-warn'}>{skill.available ? 'ready' : 'missing deps'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
