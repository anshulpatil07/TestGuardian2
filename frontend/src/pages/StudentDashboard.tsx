
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';
import QuizCard from '../Components/QuizCard';
import QuizPasswordModal from '../Components/QuizPasswordModal';
import { isElectron, openQuizWindow } from '../utils/electronIPC';

type StoredUser = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
};

type Quiz = {
  id: number;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  questionCount: number;
  hasAttempted?: boolean;
  attemptScore?: number;
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [selectedQuizTitle, setSelectedQuizTitle] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('guardian_user');
    if (!stored) {
      navigate('/signin');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredUser;
      if (parsed.role !== 'student') {
        navigate('/signin');
        return;
      }
      setUser(parsed);
    } catch (err) {
      console.error('Failed to parse stored user', err);
      navigate('/signin');
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchQuizzes = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get('/api/quiz/available');
        const quizzes = response.data.quizzes || [];
        
        // Check attempt status for each quiz
        const quizzesWithAttemptStatus = await Promise.all(
          quizzes.map(async (quiz: Quiz) => {
            try {
              const attemptResponse = await apiClient.get(`/api/quiz/${quiz.id}/attempt-status/${user.id}`);
              return {
                ...quiz,
                hasAttempted: attemptResponse.data.hasAttempted,
                attemptScore: attemptResponse.data.attempt?.score || null
              };
            } catch {
              return quiz; // If attempt status check fails, proceed without it
            }
          })
        );

        setQuizzes(quizzesWithAttemptStatus);
        setFilteredQuizzes(quizzesWithAttemptStatus);
      } catch (err) {
        console.error('Failed to fetch quizzes', err);
        setError('Unable to load quizzes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredQuizzes(quizzes);
      return;
    }

    const filtered = quizzes.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quiz.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredQuizzes(filtered);
  }, [searchQuery, quizzes]);

  const handleAttemptQuiz = (quizId: number) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    setSelectedQuizId(quizId);
    setSelectedQuizTitle(quiz.title);
    setShowPasswordModal(true);
  };

  const handleVerifyPassword = async (quizId: number, password: string): Promise<boolean> => {
    try {
      const response = await apiClient.post('/api/quiz/verify-password', {
        quizId,
        password,
      });
      return response.data.valid === true;
    } catch {
      return false;
    }
  };

  const handlePasswordSuccess = (quizId: number) => {
    setShowPasswordModal(false);
    
    // Check if running in Electron for lockdown mode
    if (isElectron()) {
      // Open quiz in lockdown fullscreen window
      openQuizWindow(quizId);
    } else {
      // Regular browser mode - navigate normally
      navigate(`/quiz-attempt/${quizId}`);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('guardian_user');
    navigate('/signin');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Student Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back, {user.name}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-7xl px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Available Quizzes</h2>
          <p className="text-sm text-slate-500 mb-6">
            Browse and attempt quizzes assigned to you.
          </p>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quizzes by title or description..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pl-10 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <svg
              className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-slate-600">Loading quizzes...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && filteredQuizzes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-700">
              {searchQuery ? 'No quizzes found' : 'No quizzes available'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery
                ? 'Try adjusting your search query.'
                : 'Check back later for new quizzes.'}
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              id={quiz.id}
              title={quiz.title}
              description={quiz.description}
              startTime={quiz.startTime}
              endTime={quiz.endTime}
              durationMinutes={quiz.durationMinutes}
              questionCount={quiz.questionCount}
              hasAttempted={quiz.hasAttempted}
              attemptScore={quiz.attemptScore}
              onAttempt={handleAttemptQuiz}
            />
          ))}
        </div>
      </main>

      <QuizPasswordModal
        quizId={selectedQuizId || 0}
        quizTitle={selectedQuizTitle}
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
        onVerify={handleVerifyPassword}
      />
    </div>
  );
};

export default StudentDashboard;