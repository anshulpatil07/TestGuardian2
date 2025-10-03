type QuizCardProps = {
  id: number;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  questionCount: number;
  hasAttempted?: boolean;
  attemptScore?: number;
  onAttempt: (quizId: number) => void;
};

const QuizCard = ({
  id,
  title,
  description,
  startTime,
  endTime,
  durationMinutes,
  questionCount,
  hasAttempted = false,
  attemptScore,
  onAttempt,
}: QuizCardProps) => {
  const formatDateTime = (value: string | null) => {
    if (!value) return 'No specific time';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const isQuizActive = () => {
    const now = new Date();
    if (startTime && new Date(startTime) > now) return false;
    if (endTime && new Date(endTime) < now) return false;
    return true;
  };

  const active = isQuizActive();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
            {durationMinutes} mins
          </span>
        </div>
        {description && (
          <p className="text-sm text-slate-600 line-clamp-2">{description}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <dt className="font-medium text-slate-500">Start Time</dt>
          <dd className="text-slate-900">{formatDateTime(startTime)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">End Time</dt>
          <dd className="text-slate-900">{formatDateTime(endTime)}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Questions</dt>
          <dd className="text-slate-900">{questionCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Status</dt>
          <dd className={active ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
            {hasAttempted ? 'Completed' : active ? 'Active' : 'Inactive'}
          </dd>
        </div>
        {hasAttempted && attemptScore !== undefined && (
          <div>
            <dt className="font-medium text-slate-500">Your Score</dt>
            <dd className="text-indigo-600 font-medium">{attemptScore} points</dd>
          </div>
        )}
      </dl>

      <button
        onClick={() => onAttempt(id)}
        disabled={!active || hasAttempted}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {hasAttempted ? 'Already Completed' : active ? 'Attempt Quiz' : 'Quiz Not Available'}
      </button>
    </div>
  );
};

export default QuizCard;
