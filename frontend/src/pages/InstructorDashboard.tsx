import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { API_BASE_URL } from '../api/axios';

type StoredUser = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
};

type QuestionType = 'mcq' | 'descriptive' | 'video' | 'photo';

type OptionForm = {
  id: string;
  optionText: string;
  isCorrect: boolean;
};

type QuestionForm = {
  id: string;
  questionText: string;
  questionType: QuestionType;
  mediaUrl?: string;
  points: number;
  options: OptionForm[];
};

type QuizSummary = {
  id: number;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
  averageScore: number;
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyOption = (isCorrect = false): OptionForm => ({
  id: createId(),
  optionText: '',
  isCorrect,
});
const createEmptyQuestion = (): QuestionForm => ({
  id: createId(),
  questionText: '',
  questionType: 'mcq',
  points: 1,
  options: [createEmptyOption(true), createEmptyOption(false)],
});

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'quizzes' | 'profile'>('create');

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [questions, setQuestions] = useState<QuestionForm[]>([createEmptyQuestion()]);
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null);

  const formattedQuestions = useMemo(() => questions, [questions]);

  useEffect(() => {
    const stored = localStorage.getItem('guardian_user');
    if (!stored) {
      navigate('/signin');
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredUser;
      if (parsed.role !== 'instructor') {
        navigate('/signin');
        return;
      }

      setUser(parsed);
    } catch (err) {
      console.error('Failed to parse stored user', err);
      navigate('/signin');
    }
  }, [navigate]);

  const fetchQuizzes = useCallback(async (instructorId: number) => {
    setQuizzesLoading(true);
    setQuizzesError(null);

    try {
      const response = await apiClient.get(`/api/quiz?instructorId=${encodeURIComponent(instructorId)}`);
      setQuizzes(response.data.quizzes ?? []);
    } catch (err) {
      console.error(err);
      setQuizzesError(
        err instanceof Error ? err.message : 'Unable to load quizzes right now.'
      );
    } finally {
      setQuizzesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchQuizzes(user.id);
  }, [fetchQuizzes, user]);

  const resetForm = () => {
    setQuizTitle('');
    setQuizDescription('');
    setStartTime('');
    setEndTime('');
    setDurationMinutes('');
    setAccessPassword('');
    setQuestions([createEmptyQuestion()]);
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions((prev) => (prev.length === 1 ? prev : prev.filter((q) => q.id !== id)));
  };

  const updateQuestion = (id: string, partial: Partial<QuestionForm>) => {
    setQuestions((prev) =>
      prev.map((question) => (question.id === id ? { ...question, ...partial } : question))
    );
  };

  const handleQuestionTextChange = (id: string, value: string) => {
    updateQuestion(id, { questionText: value });
  };

  const handlePointsChange = (id: string, value: number) => {
    updateQuestion(id, { points: Number.isNaN(value) ? 1 : Math.max(1, value) });
  };

  const handleQuestionTypeChange = (id: string, questionType: QuestionType) => {
    updateQuestion(id, { 
      questionType,
      mediaUrl: undefined, // Clear media URL when changing type
      options: questionType === 'mcq' ? [createEmptyOption(true), createEmptyOption(false)] : []
    });
  };

  const handleMediaUpload = async (id: string, file: File) => {
    setUploadingMedia(id);
    
    try {
      const formData = new FormData();
      formData.append('media', file);
      
      const response = await apiClient.post('/api/upload/media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      updateQuestion(id, { mediaUrl: response.data.url });
    } catch (error) {
      console.error('Media upload failed:', error);
      setError('Failed to upload media file.');
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleAddOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) return question;
        if (question.options.length >= 6) return question;
        return {
          ...question,
          options: [...question.options, createEmptyOption(false)],
        };
      })
    );
  };

  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) return question;
        if (question.options.length <= 2) return question;
        return {
          ...question,
          options: question.options.filter((option) => option.id !== optionId),
        };
      })
    );
  };

  const handleOptionChange = (
    questionId: string,
    optionId: string,
    partial: Partial<OptionForm>
  ) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) return question;

        const updatedOptions = question.options.map((option) => {
          if (option.id !== optionId) {
            return partial.isCorrect ? { ...option, isCorrect: false } : option;
          }

          return {
            ...option,
            ...partial,
            isCorrect: partial.isCorrect ? true : option.isCorrect,
          };
        });

        return {
          ...question,
          options: updatedOptions,
        };
      })
    );
  };

  const validateForm = () => {
    if (!quizTitle.trim()) {
      return 'Quiz name is required.';
    }

    if (!accessPassword.trim()) {
      return 'Password is required to restrict quiz access.';
    }

    if (!durationMinutes || Number.isNaN(Number(durationMinutes)) || Number(durationMinutes) <= 0) {
      return 'Duration must be a positive number of minutes.';
    }

    if (formattedQuestions.length === 0) {
      return 'Add at least one question.';
    }

    for (const [index, question] of formattedQuestions.entries()) {
      if (!question.questionText.trim()) {
        return `Question ${index + 1} requires text.`;
      }

      if (question.points <= 0) {
        return `Question ${index + 1} needs points greater than 0.`;
      }

      // Validate based on question type
      if (question.questionType === 'mcq') {
        if (question.options.length < 2) {
          return `Question ${index + 1} needs at least two options.`;
        }

        if (!question.options.some((option) => option.isCorrect)) {
          return `Question ${index + 1} needs one correct option.`;
        }

        for (const [optIndex, option] of question.options.entries()) {
          if (!option.optionText.trim()) {
            return `Question ${index + 1}, option ${optIndex + 1} needs text.`;
          }
        }
      } else if (question.questionType === 'video' || question.questionType === 'photo') {
        if (!question.mediaUrl) {
          return `Question ${index + 1} requires a ${question.questionType} file.`;
        }
      }
    }

    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Provide valid start and end times.';
      }
      if (start >= end) {
        return 'Start time must be before end time.';
      }
    }

    return null;
  };

  const handleCreateQuiz = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // Prevent form submission refresh
    
    if (!user) {
      setError('User not found. Please sign in again.');
      return;
    }

    // Inline validation
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: quizTitle.trim(),
        description: quizDescription.trim() || null,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        durationMinutes: Number(durationMinutes),
        accessPassword: accessPassword.trim(),
        createdBy: user.id,
        questions: formattedQuestions.map((question) => ({
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          mediaUrl: question.mediaUrl,
          points: question.points,
          options: question.options.map((option) => ({
            optionText: option.optionText.trim(),
            isCorrect: option.isCorrect,
          })),
        })),
      };

      await apiClient.post('/api/quiz', payload);

      setFeedback('Quiz created successfully.');
      resetForm();
      fetchQuizzes(user.id);
    } catch (err) {
      console.error(err);
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Unable to create quiz right now.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = (quizId: number, format: 'csv' | 'pdf') => {
    window.open(`${API_BASE_URL}/api/quiz/${quizId}/export?format=${format}`, '_blank');
  };

  const handleViewResponses = (quizId: number) => {
    // Open responses in a new tab/window
    window.open(`${API_BASE_URL}/api/quiz/${quizId}/export?format=html`, '_blank');
  };

  const handleViewQuiz = async (quizId: number) => {
    setActiveTab('quizzes');
    try {
      const response = await apiClient.get(`/api/quiz/${quizId}`);
      const quiz = response.data.quiz;
      
      setEditingQuizId(quizId);
      setQuizTitle(quiz.title);
      setQuizDescription(quiz.description || '');
      setStartTime(quiz.startTime ? new Date(quiz.startTime).toISOString().slice(0, 16) : '');
      setEndTime(quiz.endTime ? new Date(quiz.endTime).toISOString().slice(0, 16) : '');
      setDurationMinutes(quiz.durationMinutes.toString());
      setAccessPassword(quiz.accessPassword);
      
      const loadedQuestions = quiz.questions.map((q: { questionText: string; questionType: QuestionType; mediaUrl?: string; points: number; options: Array<{ optionText: string; isCorrect: boolean }> }) => ({
        id: createId(),
        questionText: q.questionText,
        questionType: q.questionType || 'mcq',
        mediaUrl: q.mediaUrl,
        points: q.points,
        options: q.options.map((opt: { optionText: string; isCorrect: boolean }) => ({
          id: createId(),
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
        })),
      }));
      
      setQuestions(loadedQuestions);
      setActiveTab('create');
    } catch (err) {
      console.error('Failed to load quiz', err);
      setError('Failed to load quiz for editing.');
    }
  };

  const handleCancelEdit = () => {
    setEditingQuizId(null);
    resetForm();
  };

  const handleUpdateQuiz = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    if (!user || !editingQuizId) return;

    const validationIssue = validateForm();
    if (validationIssue) {
      setError(validationIssue);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: quizTitle.trim(),
        description: quizDescription.trim() || null,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        durationMinutes: Number(durationMinutes),
        accessPassword: accessPassword.trim(),
        questions: formattedQuestions.map((question) => ({
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          mediaUrl: question.mediaUrl,
          points: question.points,
          options: question.options.map((option) => ({
            optionText: option.optionText.trim(),
            isCorrect: option.isCorrect,
          })),
        })),
      };

      await apiClient.put(`/api/quiz/${editingQuizId}`, payload);

      setFeedback('Quiz updated successfully.');
      setEditingQuizId(null);
      resetForm();
      fetchQuizzes(user.id);
    } catch (err) {
      console.error(err);
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Unable to update quiz right now.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileFeedback(null);
    setProfileError(null);

    if (!user) return;

    if (newPassword !== confirmPassword) {
      setProfileError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setProfileError('Password must be at least 6 characters.');
      return;
    }

    setProfileLoading(true);

    try {
      await apiClient.put('/api/auth/change-password', {
        userId: user.id,
        currentPassword,
        newPassword,
      });

      setProfileFeedback('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Unable to change password right now.';
      setProfileError(errorMessage);
    } finally {
      setProfileLoading(false);
    }
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return 'N/A';
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      console.error('Failed to format datetime', error);
      return value;
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('guardian_user');
    navigate('/signin');
  };

  const parseCSV = (csvText: string): Array<{ questionNo: number; question: string; marks: number }> => {
    const lines = csvText.trim().split('\n');
    const questions: Array<{ questionNo: number; question: string; marks: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line (handle quoted fields)
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      
      if (fields.length < 3) {
        throw new Error(`Row ${i + 1}: Expected 3 columns (Question No, Question, Marks), found ${fields.length}`);
      }
      
      const questionNo = parseInt(fields[0]);
      const question = fields[1];
      const marks = parseInt(fields[2]);
      
      if (isNaN(questionNo) || questionNo <= 0) {
        throw new Error(`Row ${i + 1}: Question number must be a positive integer`);
      }
      
      if (!question.trim()) {
        throw new Error(`Row ${i + 1}: Question text cannot be empty`);
      }
      
      if (isNaN(marks) || marks <= 0) {
        throw new Error(`Row ${i + 1}: Marks must be a positive integer`);
      }
      
      questions.push({ questionNo, question, marks });
    }
    
    return questions;
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCsvImportError(null);
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvImportError('Please select a CSV file.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const csvQuestions = parseCSV(csvText);
        
        if (csvQuestions.length === 0) {
          setCsvImportError('CSV file is empty or contains no valid questions.');
          return;
        }
        
        // Convert CSV questions to QuestionForm format
        const newQuestions: QuestionForm[] = csvQuestions.map((csvQ) => ({
          id: createId(),
          questionText: csvQ.question,
          questionType: 'mcq', // Default to MCQ for CSV imports
          points: csvQ.marks,
          options: [createEmptyOption(true), createEmptyOption(false)], // Default 2 options
        }));
        
        // Replace existing questions with imported ones
        setQuestions(newQuestions);
        setFeedback(`Successfully imported ${newQuestions.length} questions from CSV.`);
        
      } catch (error) {
        setCsvImportError(error instanceof Error ? error.message : 'Failed to parse CSV file.');
      }
    };
    
    reader.onerror = () => {
      setCsvImportError('Failed to read the CSV file.');
    };
    
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Instructor Dashboard</h1>
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

      <nav className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => {
                setActiveTab('create');
                if (!editingQuizId) resetForm();
              }}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {editingQuizId ? 'Edit Quiz' : 'Create Quiz'}
            </button>
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'quizzes'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              My Quizzes
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Profile
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto mt-10 max-w-7xl px-6 space-y-12">
        {activeTab === 'create' && (
        <section>
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {editingQuizId ? 'Edit Quiz' : 'Create New Quiz'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingQuizId 
                    ? 'Update quiz details and questions.' 
                    : 'Set quiz basics, add questions, and publish when ready.'}
                </p>
              </div>
              {editingQuizId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {feedback && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedback}
              </div>
            )}

            <form className="space-y-6" onSubmit={editingQuizId ? handleUpdateQuiz : handleCreateQuiz}>
              <div className="grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Quiz Name *</span>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(event) => setQuizTitle(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Midterm Assessment"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Access Password *</span>
                  <input
                    type="text"
                    value={accessPassword}
                    onChange={(event) => setAccessPassword(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter a secure password"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    value={quizDescription}
                    onChange={(event) => setQuizDescription(event.target.value)}
                    rows={3}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Optional overview or instructions for learners"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Start Date &amp; Time</span>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">End Date &amp; Time</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Duration (minutes) *</span>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="60"
                    required
                  />
                </label>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Questions</h3>
                  <div className="flex gap-3">
                    <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                      Import CSV
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVImport}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    >
                      Add question
                    </button>
                  </div>
                </div>

                {csvImportError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {csvImportError}
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  <strong>CSV Format:</strong> Question No, Question, Marks
                  <br />
                  <span className="text-xs text-blue-600">
                    Example: 1,"What is 2+2?",5
                  </span>
                </div>

                {formattedQuestions.map((question, questionIndex) => (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-900">
                        Question {questionIndex + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(question.id)}
                        className="text-sm font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium text-slate-700">Question Text *</span>
                          <textarea
                            value={question.questionText}
                            onChange={(event) =>
                              handleQuestionTextChange(question.id, event.target.value)
                            }
                            rows={3}
                            className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                            placeholder="Enter the question prompt"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium text-slate-700">Points *</span>
                          <input
                            type="number"
                            min={1}
                            value={question.points}
                            onChange={(event) =>
                              handlePointsChange(question.id, Number(event.target.value))
                            }
                            className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-medium text-slate-700">Question Type *</span>
                          <select
                            value={question.questionType}
                            onChange={(event) =>
                              handleQuestionTypeChange(question.id, event.target.value as QuestionType)
                            }
                            className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="mcq">Multiple Choice (MCQ)</option>
                            <option value="descriptive">Descriptive</option>
                            <option value="video">Video Question</option>
                            <option value="photo">Photo Question</option>
                          </select>
                        </label>

                        {(question.questionType === 'video' || question.questionType === 'photo') && (
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {question.questionType === 'video' ? 'Video File' : 'Photo File'} *
                            </span>
                            {question.mediaUrl ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-green-600">✓ File uploaded</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuestion(question.id, { mediaUrl: undefined })}
                                  className="text-sm text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm hover:bg-slate-50">
                                {uploadingMedia === question.id ? 'Uploading...' : `Upload ${question.questionType}`}
                                <input
                                  type="file"
                                  accept={question.questionType === 'video' ? 'video/*' : 'image/*'}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) handleMediaUpload(question.id, file);
                                  }}
                                  className="hidden"
                                  disabled={uploadingMedia === question.id}
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {question.questionType === 'mcq' && (
                      <div className="mt-6 space-y-4">
                        <h5 className="text-sm font-semibold text-slate-700">Options</h5>
                        <div className="space-y-3">
                          {question.options.map((option, optionIndex) => (
                          <div
                            key={option.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center"
                          >
                            <div className="flex flex-1 flex-col gap-2">
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Option {optionIndex + 1}
                              </span>
                              <input
                                type="text"
                                value={option.optionText}
                                onChange={(event) =>
                                  handleOptionChange(question.id, option.id, {
                                    optionText: event.target.value,
                                  })
                                }
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                                placeholder="Answer choice"
                              />
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                <input
                                  type="radio"
                                  name={`correct-${question.id}`}
                                  checked={option.isCorrect}
                                  onChange={() =>
                                    handleOptionChange(question.id, option.id, {
                                      isCorrect: true,
                                    })
                                  }
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                Correct answer
                              </label>

                              <button
                                type="button"
                                onClick={() => handleRemoveOption(question.id, option.id)}
                                className="text-sm font-medium text-rose-600 hover:text-rose-700"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddOption(question.id)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Add option (max 6)
                      </button>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={editingQuizId ? handleCancelEdit : resetForm}
                  className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  disabled={submitting}
                >
                  {editingQuizId ? 'Cancel' : 'Reset'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {submitting ? (editingQuizId ? 'Updating…' : 'Creating…') : (editingQuizId ? 'Update quiz' : 'Create quiz')}
                </button>
              </div>
            </form>
          </div>
        </section>
        )}

        {activeTab === 'quizzes' && (

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Previous Quizzes</h2>
              <p className="text-sm text-slate-500">
                Review past quizzes, monitor performance, and export results.
              </p>
            </div>
          </div>

          {quizzesLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Loading quizzes…
            </div>
          )}

          {quizzesError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 shadow-sm">
              {quizzesError}
            </div>
          )}

          {!quizzesLoading && !quizzesError && quizzes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <h3 className="text-lg font-semibold text-slate-700">No quizzes yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Create your first quiz to see results and export performance data.
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-slate-500">{quiz.description}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                      {quiz.durationMinutes} mins
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <dt className="font-medium text-slate-500">Start</dt>
                      <dd>{formatDateTime(quiz.startTime)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">End</dt>
                      <dd>{formatDateTime(quiz.endTime)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Questions</dt>
                      <dd>{quiz.questionCount}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Attempts</dt>
                      <dd>{quiz.attemptCount}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Average Score</dt>
                      <dd>{quiz.averageScore}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Created</dt>
                      <dd>{formatDateTime(quiz.createdAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleViewQuiz(quiz.id)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    View/Edit
                  </button>
                  <button
                    onClick={() => handleViewResponses(quiz.id)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    View Responses
                  </button>
                  <button
                    onClick={() => handleExport(quiz.id, 'csv')}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExport(quiz.id, 'pdf')}
                    className="rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {activeTab === 'profile' && (
        <section>
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">Profile Settings</h2>
              <p className="text-sm text-slate-500">
                Update your account information and security settings.
              </p>
            </div>

            <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Account Information</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Name</dt>
                  <dd className="text-base text-slate-900">{user.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Email</dt>
                  <dd className="text-base text-slate-900">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Role</dt>
                  <dd className="text-base text-slate-900 capitalize">{user.role}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Change Password</h3>
              
              {profileError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileError}
                </div>
              )}

              {profileFeedback && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {profileFeedback}
                </div>
              )}

              <form className="space-y-6" onSubmit={handlePasswordChange}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Current Password *</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter current password"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">New Password *</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Confirm New Password *</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Re-enter new password"
                    required
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  >
                    {profileLoading ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
        )}
      </main>
    </div>
  );
};

export default InstructorDashboard;