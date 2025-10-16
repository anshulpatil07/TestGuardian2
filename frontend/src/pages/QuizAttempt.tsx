import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import apiClient from '../api/axios';
import Calculator from '../Component/Calculator';
import {
  isElectron,
  closeQuizWindow,
  allowQuizExit,
  onQuizWindowBlur,
  onQuizLeaveFullscreen,
  onQuizMinimizeAttempt,
  onQuizCloseAttempt,
  onAutoSubmitQuiz,
  onQuizViolationDetected,
} from '../utils/electronIPC';

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

type QuestionType = 'mcq' | 'descriptive' | 'video' | 'photo';

type Question = {
  id: number;
  questionText: string;
  questionType: QuestionType;
  mediaUrl?: string;
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
  optionId?: number | null;
  textResponse?: string;
  mediaResponse?: string;
};

type Violation = {
  type: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
};

const QuizAttempt = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();
  const isLockdownMode = searchParams.get('lockdown') === 'true';

  const [user, setUser] = useState<StoredUser | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lockdown mode states
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Violation tracking state
  const [violations, setViolations] = useState<Violation[]>([]);
  const [showViolationHistory, setShowViolationHistory] = useState(false);

  // Submission result state for non-blocking success modal
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    maxScore: number;
    attemptId: string;
  } | null>(null);

  const MAX_WARNINGS = 3;

  // Ref to store submit handler to avoid circular dependency
  const submitQuizRef = useRef<(() => Promise<void>) | null>(null);

  // Handle warning trigger
  const handleWarningTrigger = useCallback((reason: string, violation?: Violation) => {
    if (!isLockdownMode || isSubmitting || isAutoSubmitting) return;

    // Add violation to history if provided
    if (violation) {
      setViolations(prev => [...prev, violation]);
    }

    setWarningCount((prevCount) => {
      const newCount = prevCount + 1;
      
      if (newCount >= MAX_WARNINGS) {
        setWarningMessage(`Final warning! Auto-submitting quiz...`);
        setShowWarning(true);
        setIsAutoSubmitting(true);
        
        // Auto-submit after showing warning
        setTimeout(() => {
          setShowWarning(false); // Hide warning before submit
          if (submitQuizRef.current) {
            submitQuizRef.current();
          }
        }, 2000);
      } else {
        setWarningMessage(
          `Warning ${newCount}/${MAX_WARNINGS}: ${reason}. After ${MAX_WARNINGS} warnings, your quiz will be auto-submitted.`
        );
        setShowWarning(true);
        
        // Hide warning after 4 seconds
        setTimeout(() => setShowWarning(false), 4000);
      }
      
      return newCount;
    });
  }, [isLockdownMode, isSubmitting, isAutoSubmitting, MAX_WARNINGS]);

  // Browser event listeners for lockdown mode
  useEffect(() => {
    if (!isLockdownMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleWarningTrigger('Switching tabs or minimizing browser is not allowed');
      }
    };

    const handleWindowBlur = () => {
      handleWarningTrigger('Switching away from the quiz window is not allowed');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isLockdownMode, handleWarningTrigger]);

  // Electron IPC event listeners for lockdown mode
  useEffect(() => {
    if (!isLockdownMode || !isElectron()) return;

    const cleanupBlur = onQuizWindowBlur(() => {
      handleWarningTrigger('Switching away from the quiz window is not allowed');
    });

    const cleanupFullscreen = onQuizLeaveFullscreen(() => {
      handleWarningTrigger('Exiting fullscreen mode is not allowed');
    });

    const cleanupMinimize = onQuizMinimizeAttempt(() => {
      handleWarningTrigger('Minimizing the quiz window is not allowed');
    });

    const cleanupClose = onQuizCloseAttempt(() => {
      handleWarningTrigger('Closing the quiz window is not allowed');
    });

    const cleanupAutoSubmit = onAutoSubmitQuiz(() => {
      setIsAutoSubmitting(true);
      if (submitQuizRef.current) {
        submitQuizRef.current();
      }
    });

    const cleanupViolationDetected = onQuizViolationDetected((violation: Violation) => {
      handleWarningTrigger(violation.message, violation);
    });

    return () => {
      cleanupBlur();
      cleanupFullscreen();
      cleanupMinimize();
      cleanupClose();
      cleanupAutoSubmit();
      cleanupViolationDetected();
    };
  }, [isLockdownMode, handleWarningTrigger]);

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
          optionId: q.questionType === 'mcq' ? null : undefined,
          textResponse: (q.questionType === 'descriptive' || q.questionType === 'video' || q.questionType === 'photo') ? '' : undefined,
          mediaResponse: undefined, // Not used anymore
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

    // Check if all questions are answered (skip confirmation for auto-submit)
    const unanswered = selectedAnswers.filter((ans) => ans.optionId === null);
    if (unanswered.length > 0 && timeRemaining !== 0 && !isAutoSubmitting) {
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
        violations,
        status: isAutoSubmitting ? 'auto_submitted' : 'submitted',
      });

      const { score, maxScore, attemptId } = response.data;

      // Set submission result to trigger success modal
      setSubmissionResult({ score, maxScore, attemptId: String(attemptId) });

    } catch (err) {
      console.error('Failed to submit quiz', err);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, quiz, isSubmitting, selectedAnswers, timeRemaining, isAutoSubmitting, violations]);

  // Store the submit handler in ref for use in warning trigger
  useEffect(() => {
    submitQuizRef.current = handleSubmitQuiz;
  }, [handleSubmitQuiz]);

  // Handle window close or navigation after successful submission
  useEffect(() => {
    if (!submissionResult) return;

    if (isLockdownMode && isElectron()) {
      // Allow the quiz window to exit first (remove lockdown restrictions)
      allowQuizExit();
      
      // Wait 4 seconds before closing the Electron window
      const timer = setTimeout(() => {
        closeQuizWindow();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // If not in lockdown mode, navigate to dashboard after 4 seconds
      const timer = setTimeout(() => {
        navigate('/student-dashboard');
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [submissionResult, isLockdownMode, navigate]);

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

  const handleTextResponseChange = (text: string) => {
    const updatedAnswers = [...selectedAnswers];
    updatedAnswers[currentQuestionIndex].textResponse = text;
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
  const currentAnswer = selectedAnswers[currentQuestionIndex] || {
    questionId: currentQuestion.id,
    optionId: currentQuestion.questionType === 'mcq' ? null : undefined,
    textResponse: (currentQuestion.questionType === 'descriptive' || currentQuestion.questionType === 'video' || currentQuestion.questionType === 'photo') ? '' : undefined,
    mediaResponse: undefined, // Not used anymore
  };
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Success Modal - Non-blocking */}
      {submissionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="rounded-2xl border-2 border-green-500 bg-white p-8 shadow-2xl max-w-md mx-4 text-center">
            <svg
              className="h-16 w-16 text-green-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Quiz Submitted Successfully!
            </h3>
            <p className="text-lg text-slate-600 mb-1">
              Your Score: <span className="font-bold text-green-600">{submissionResult.score} / {submissionResult.maxScore}</span>
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Attempt ID: {submissionResult.attemptId}
            </p>
            <p className="text-slate-600">
              {isLockdownMode
                ? 'This window will close automatically in a moment...'
                : 'Redirecting to dashboard...'}
            </p>
            <div className="mt-4 flex items-center justify-center">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2" style={{ animationDelay: '0.2s' }}></div>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit Loading Overlay */}
      {isAutoSubmitting && !showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-8 shadow-2xl max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent mr-3"></div>
              <h3 className="text-xl font-bold text-red-900">
                Submitting Quiz...
              </h3>
            </div>
            <p className="text-lg text-red-800">
              Please wait while we submit your quiz.
            </p>
          </div>
        </div>
      )}

      {/* Lockdown Warning Popup */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div
            className={`rounded-2xl border-2 p-8 shadow-2xl max-w-md mx-4 ${
              warningCount >= MAX_WARNINGS
                ? 'bg-red-50 border-red-500'
                : 'bg-yellow-50 border-yellow-500'
            }`}
          >
            <div className="flex items-center mb-4">
              <svg
                className={`h-8 w-8 mr-3 ${
                  warningCount >= MAX_WARNINGS ? 'text-red-600' : 'text-yellow-600'
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3
                className={`text-xl font-bold ${
                  warningCount >= MAX_WARNINGS ? 'text-red-900' : 'text-yellow-900'
                }`}
              >
                {warningCount >= MAX_WARNINGS ? 'Final Warning!' : `Warning ${warningCount}/${MAX_WARNINGS}`}
              </h3>
            </div>
            <p
              className={`text-lg ${
                warningCount >= MAX_WARNINGS ? 'text-red-800' : 'text-yellow-800'
              }`}
            >
              {warningMessage}
            </p>
            {warningCount >= MAX_WARNINGS && (
              <div className="mt-4 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{quiz.title}</h1>
            <p className="text-sm text-slate-500">
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Violation History Button */}
            {isLockdownMode && violations.length > 0 && (
              <button
                onClick={() => setShowViolationHistory(true)}
                className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-red-700 hover:bg-red-200 transition-colors"
                title="View Violation History"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Violations ({violations.length})
              </button>
            )}
            
            {/* Calculator Button */}
            <button
              onClick={() => setIsCalculatorOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Open Calculator"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Calculator
            </button>
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
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
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
            
            {/* Display media for video/photo questions */}
            {currentQuestion.mediaUrl && (
              <div className="mb-4">
                {currentQuestion.questionType === 'video' ? (
                  <video
                    controls
                    className="w-full max-w-md rounded-lg"
                    src={currentQuestion.mediaUrl.startsWith('http') ? currentQuestion.mediaUrl : `http://localhost:5000${currentQuestion.mediaUrl}`}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : currentQuestion.questionType === 'photo' ? (
                  <img
                    src={currentQuestion.mediaUrl.startsWith('http') ? currentQuestion.mediaUrl : `http://localhost:5000${currentQuestion.mediaUrl}`}
                    alt="Question image"
                    className="w-full max-w-md rounded-lg"
                  />
                ) : null}
              </div>
            )}
          </div>

          {/* Render based on question type */}
          {currentQuestion.questionType === 'mcq' && (
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
          )}

          {currentQuestion.questionType === 'descriptive' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Your Answer
              </label>
              <textarea
                value={currentAnswer.textResponse || ''}
                onChange={(e) => handleTextResponseChange(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Type your answer here..."
              />
            </div>
          )}

          {(currentQuestion.questionType === 'video' || currentQuestion.questionType === 'photo') && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Your Answer
              </label>
              <textarea
                value={currentAnswer.textResponse || ''}
                onChange={(e) => handleTextResponseChange(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                placeholder={`Describe what you see in the ${currentQuestion.questionType}...`}
              />
            </div>
          )}

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
              {quiz.questions.map((q, index) => {
                const ans = selectedAnswers[index];
                const answered = q.questionType === 'mcq'
                  ? ans.optionId !== null
                  : (ans.textResponse || '').trim().length > 0;
                const skipped = !answered && index < currentQuestionIndex;
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      index === currentQuestionIndex
                        ? 'bg-indigo-600'
                        : answered
                        ? 'bg-green-500'
                        : skipped
                        ? 'bg-red-500'
                        : 'bg-slate-300'
                    }`}
                    title={`Question ${index + 1}`}
                  />
                );
              })}
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

          {/* Right-side question panel */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-full sticky top-6">
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                  {user.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-slate-500">Candidate</div>
                  <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={user.name}>{user.name}</div>
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Question Palette</h3>
              {timeRemaining !== null && (
                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                  timeRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {formatTime(timeRemaining)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {quiz.questions.map((q, index) => {
                const ans = selectedAnswers[index];
                const answered = q.questionType === 'mcq'
                  ? ans.optionId !== null
                  : (ans.textResponse || '').trim().length > 0;
                const skipped = !answered && index < currentQuestionIndex;
                const isCurrent = index === currentQuestionIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`h-10 w-10 rounded-lg text-sm font-semibold flex items-center justify-center border transition ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : answered
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : skipped
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title={`Question ${index + 1}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-500 inline-block" /> Answered</div>
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500 inline-block" /> Skipped</div>
              <div className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-slate-300 inline-block" /> Not visited</div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
              <div className="text-[11px] text-slate-500 text-center">Review your palette before submitting</div>
            </div>
          </aside>
        </div>
      </main>

      {/* Violation History Modal */}
      {showViolationHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-900">Violation History</h3>
              <button
                onClick={() => setShowViolationHistory(false)}
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-96">
              {violations.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-600">No violations detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {violations.map((violation, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${
                        violation.severity === 'high'
                          ? 'bg-red-50 border-red-500'
                          : violation.severity === 'medium'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                violation.severity === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : violation.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {violation.severity.toUpperCase()}
                            </span>
                            <span className="text-sm text-slate-500">{violation.timestamp}</span>
                          </div>
                          <p className={`font-medium ${
                            violation.severity === 'high'
                              ? 'text-red-800'
                              : violation.severity === 'medium'
                              ? 'text-yellow-800'
                              : 'text-blue-800'
                          }`}>
                            {violation.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-slate-500">
                Total violations: {violations.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViolations([])}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Clear History
                </button>
                <button
                  onClick={() => setShowViolationHistory(false)}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      <Calculator 
        isOpen={isCalculatorOpen} 
        onClose={() => setIsCalculatorOpen(false)} 
      />
    </div>
  );
};

export default QuizAttempt;
