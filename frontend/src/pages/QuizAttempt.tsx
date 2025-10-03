import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/axios';

type StoredUser = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
};

type Option = {
  id: number;
  optionText: string;
};

type Question = {
  id: number;
  questionText: string;
  points: number;
  options: Option[];
};

type QuizData = {
  id: number;
  title: string;
  durationMinutes: number;
  questions: Question[];
};

type SelectedAnswer = {
  questionId: number;
  optionId: number | null;
};

const QuizAttempt = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    } catch {
      navigate('/signin');
    }
  }, [navigate]);

  useEffect(() => {
    if (!user || !quizId) return;

    const fetchQuizQuestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get(`/api/quiz/${quizId}/questions`);
        const quizData = response.data as QuizData;
        setQuiz(quizData);

        // Initialize selected answers array
        const initialAnswers = quizData.questions.map((q) => ({
          questionId: q.id,
          optionId: null,
        }));
        setSelectedAnswers(initialAnswers);

        // Set timer
        if (quizData.durationMinutes > 0) {
          setTimeRemaining(quizData.durationMinutes * 60);
        }
      } catch (err) {
        console.error('Failed to fetch quiz questions', err);
        setError('Unable to load quiz. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizQuestions();
  }, [user, quizId]);

  const handleSubmitQuiz = useCallback(async () => {
    if (!user || !quiz || isSubmitting) return;

    // Check if all questions are answered
    const unanswered = selectedAnswers.filter((ans) => ans.optionId === null);
    if (unanswered.length > 0 && timeRemaining !== 0) {
      const confirmed = window.confirm(
        `You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      const responses = selectedAnswers
        .filter((ans) => ans.optionId !== null)
        .map((ans) => ({
          questionId: ans.questionId,
          optionId: ans.optionId as number,
        }));

      const response = await apiClient.post(`/api/quiz/${quiz.id}/attempt`, {
        userId: user.id,
        responses,
      });

      const { score, maxScore, attemptId } = response.data;

      alert(
        `Quiz submitted successfully!\nYour Score: ${score}/${maxScore}\nAttempt ID: ${attemptId}`
      );

      navigate('/student-dashboard');
    } catch (err) {
      console.error('Failed to submit quiz', err);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, quiz, isSubmitting, selectedAnswers, timeRemaining, navigate]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, handleSubmitQuiz]);

  const handleSelectOption = (optionId: number) => {
    const updatedAnswers = [...selectedAnswers];
    updatedAnswers[currentQuestionIndex].optionId = optionId;
    setSelectedAnswers(updatedAnswers);
  };

  const handleNext = () => {
    if (!quiz) return;
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-slate-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-lg max-w-md">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
          <p className="text-slate-600 mb-6">{error || 'Quiz not found'}</p>
          <button
            onClick={() => navigate('/student-dashboard')}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const currentAnswer = selectedAnswers[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{quiz.title}</h1>
            <p className="text-sm text-slate-500">
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </p>
          </div>
          {timeRemaining !== null && (
            <div
              className={`rounded-lg px-4 py-2 font-semibold ${
                timeRemaining < 60
                  ? 'bg-red-100 text-red-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-4xl px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {currentQuestion.questionText}
              </h2>
              <span className="ml-4 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = currentAnswer.optionId === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      className={`mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="h-4 w-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className={`${isSelected ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                      {option.optionText}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className={`rounded-lg border px-6 py-2.5 font-medium transition ${
                currentQuestionIndex === 0
                  ? 'cursor-not-allowed border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Previous
            </button>

            <div className="flex gap-1">
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === currentQuestionIndex
                      ? 'bg-indigo-600'
                      : selectedAnswers[index].optionId !== null
                      ? 'bg-green-500'
                      : 'bg-slate-300'
                  }`}
                  title={`Question ${index + 1}`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white hover:bg-indigo-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuizAttempt;
