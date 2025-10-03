import { useState } from 'react';

type QuizPasswordModalProps = {
  quizId: number;
  quizTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (quizId: number) => void;
  onVerify: (quizId: number, password: string) => Promise<boolean>;
};

const QuizPasswordModal = ({
  quizId,
  quizTitle,
  isOpen,
  onClose,
  onSuccess,
  onVerify,
}: QuizPasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isValid = await onVerify(quizId, password);
      if (isValid) {
        setPassword('');
        onSuccess(quizId);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Failed to verify password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-slate-900">Enter Quiz Password</h2>
          <p className="text-sm text-slate-500 mt-1">
            Password required to attempt: <span className="font-medium text-slate-900">{quizTitle}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Enter quiz password"
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {loading ? 'Verifying...' : 'Start Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuizPasswordModal;
