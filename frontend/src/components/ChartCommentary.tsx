import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Plus, X, AtSign } from 'lucide-react';

export interface SectionComment {
  id: string;
  text: string;
  mentions: string[];
  timestamp: string;
  author: string;
}

const TEAMS = [
  'Risk',
  'Data Science',
  'Compliance',
  'Operations',
  'Model Governance',
  'Executive',
  'Credit',
  'Audit',
];

// colour mapping per team for chips
const TEAM_COLORS: Record<string, string> = {
  'Risk':            'bg-red-100 text-red-800 border-red-200',
  'Data Science':    'bg-blue-100 text-blue-800 border-blue-200',
  'Compliance':      'bg-purple-100 text-purple-800 border-purple-200',
  'Operations':      'bg-orange-100 text-orange-800 border-orange-200',
  'Model Governance':'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Executive':       'bg-slate-100 text-slate-800 border-slate-200',
  'Credit':          'bg-green-100 text-green-800 border-green-200',
  'Audit':           'bg-yellow-100 text-yellow-800 border-yellow-200',
};

interface ChartCommentaryProps {
  sectionId: string;
  sectionLabel: string;
  comments: SectionComment[];
  onAdd: (comment: SectionComment) => void;
  onDelete: (id: string) => void;
  isDark?: boolean;
}

export const ChartCommentary: React.FC<ChartCommentaryProps> = ({
  sectionId,
  sectionLabel,
  comments,
  onAdd,
  onDelete,
  isDark = false,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTeamPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const comment: SectionComment = {
      id: `${sectionId}-${Date.now()}`,
      text: trimmed,
      mentions: selectedMentions,
      timestamp: new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }),
      author: 'You',
    };
    onAdd(comment);
    setDraft('');
    setSelectedMentions([]);
  };

  const toggleMention = (team: string) => {
    setSelectedMentions(prev =>
      prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
    );
  };

  const bg    = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const inner = isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200';
  const text  = isDark ? 'text-slate-200' : 'text-slate-800';
  const sub   = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`mt-4 rounded-lg border ${bg}`} id={`commentary-${sectionId}`}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${text} hover:opacity-80 transition-opacity`}
      >
        <span className="flex items-center gap-2">
          <MessageSquare size={15} className="text-blue-500" />
          Commentary — {sectionLabel}
          {comments.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold rounded-full bg-blue-600 text-white px-1">
              {comments.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className={`px-4 pb-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          {/* Existing comments */}
          {comments.length > 0 && (
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1">
              {comments.map(c => (
                <div key={c.id} className={`relative rounded-lg border p-3 ${inner}`}>
                  <button
                    onClick={() => onDelete(c.id)}
                    className={`absolute top-2 right-2 p-0.5 rounded hover:bg-red-100 ${sub}`}
                    title="Delete comment"
                  >
                    <X size={12} />
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`text-xs font-semibold ${text}`}>{c.author}</span>
                    <span className={`text-xs ${sub}`}>{c.timestamp}</span>
                    {c.mentions.map(m => (
                      <span
                        key={m}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${TEAM_COLORS[m] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        @{m}
                      </span>
                    ))}
                  </div>
                  <p className={`text-sm ${text} leading-relaxed`}>{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Draft area */}
          <div className={`mt-3 rounded-lg border ${inner} p-3 space-y-2`}>
            <textarea
              rows={3}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Add your commentary here…"
              className={`w-full text-sm resize-none rounded border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />

            {/* Mention + selected chips row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* @Mention button */}
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setShowTeamPicker(p => !p)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                    showTeamPicker
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <AtSign size={11} />
                  Mention Team
                </button>

                {showTeamPicker && (
                  <div className={`absolute left-0 top-8 z-50 w-48 rounded-lg border shadow-lg ${
                    isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'
                  }`}>
                    {TEAMS.map(team => (
                      <button
                        key={team}
                        onClick={() => toggleMention(team)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 ${
                          selectedMentions.includes(team)
                            ? isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700 font-semibold'
                            : isDark ? 'text-slate-200' : 'text-slate-700'
                        }`}
                      >
                        @{team}
                        {selectedMentions.includes(team) && <span className="text-blue-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected mention chips */}
              {selectedMentions.map(m => (
                <span
                  key={m}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TEAM_COLORS[m] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                >
                  @{m}
                  <button onClick={() => toggleMention(m)} className="hover:opacity-70">
                    <X size={9} />
                  </button>
                </span>
              ))}

              {/* Add button */}
              <button
                onClick={handleAdd}
                disabled={!draft.trim()}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={11} />
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
