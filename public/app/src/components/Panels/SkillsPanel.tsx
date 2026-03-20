import { useState, useEffect } from "react";

interface Skill {
  name: string;
  hasSkillFile: boolean;
}

export default function SkillsPanel({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-1 shrink-0">
        <span className="text-xs font-medium text-gray-300">Skills</span>
        <button className="text-gray-500 hover:text-white text-sm px-1" onClick={onClose}>✕</button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Loading...</div>
      ) : skills.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
          <div className="text-center">
            <div>No skills found</div>
            <div className="text-gray-700 mt-1">Add skills to .claude/skills/</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {skills.map((s) => (
            <div key={s.name} className="px-3 py-2 border-b border-border">
              <span className="text-xs text-gray-200">{s.name}</span>
              {!s.hasSkillFile && (
                <span className="text-xs text-gray-600 ml-2">(no SKILL.md)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
