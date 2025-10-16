import express from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../db/prisma.js';

const router = express.Router();

// ============================================================
// STUDENT ROUTES - Get Available Quizzes
// ============================================================
router.get('/available', async (req, res) => {
  try {
    const now = new Date();

    const quizzes = await prisma.quiz.findMany({
      where: {
        OR: [
          {
            AND: [
              { startTime: { lte: now } },
              { endTime: { gte: now } }
            ]
          },
          {
            AND: [
              { startTime: null },
              { endTime: null }
            ]
          },
          {
            AND: [
              { startTime: { lte: now } },
              { endTime: null }
            ]
          },
          {
            AND: [
              { startTime: null },
              { endTime: { gte: now } }
            ]
          }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        durationMinutes: true,
        _count: {
          select: { questions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedQuizzes = quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      startTime: quiz.startTime,
      endTime: quiz.endTime,
      durationMinutes: quiz.durationMinutes,
      questionCount: quiz._count.questions
    }));

    res.json({ quizzes: formattedQuizzes });
  } catch (error) {
    console.error('Error fetching available quizzes:', error);
    res.status(500).json({ message: 'Failed to fetch quizzes' });
  }
});

// ============================================================
// STUDENT ROUTES - Verify Quiz Password
// ============================================================
router.post('/verify-password', async (req, res) => {
  try {
    const { quizId, password } = req.body;

    if (!quizId || !password) {
      return res.status(400).json({ message: 'Quiz ID and password are required' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: Number(quizId) },
      select: { accessPassword: true }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const valid = quiz.accessPassword === password;
    res.json({ valid });
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({ message: 'Failed to verify password' });
  }
});

// ============================================================
// STUDENT ROUTES - Submit Quiz Attempt
// ============================================================
router.post('/:id/attempt', async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const { userId, responses, violations = [], status } = req.body;

    if (!userId || !responses || !Array.isArray(responses)) {
      return res.status(400).json({ message: 'User ID and responses array are required' });
    }

    // Check if user has already attempted this quiz
    const existingAttempt = await prisma.attempt.findUnique({
      where: {
        userId_quizId: {
          userId: Number(userId),
          quizId: quizId
        }
      }
    });

    if (existingAttempt) {
      return res.status(400).json({ 
        message: 'You have already attempted this quiz. Multiple attempts are not allowed.' 
      });
    }

    // Verify quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Create attempt and responses in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create attempt
      const attempt = await tx.attempt.create({
        data: {
          userId: Number(userId),
          quizId: quizId,
          startedAt: new Date(),
          submittedAt: new Date(),
          status: status === 'auto_submitted' ? 'auto_submitted' : 'submitted'
        }
      });

      // Calculate score and store responses
      let totalScore = 0;
      let maxScore = 0;

      for (const response of responses) {
        const question = quiz.questions.find((q) => q.id === Number(response.questionId));
        if (!question) continue;

        maxScore += question.points;

        let isCorrect = false;
        
        // Handle different question types
        if (question.questionType === 'mcq') {
          const selectedOption = question.options.find((opt) => opt.id === Number(response.optionId));
          isCorrect = selectedOption?.isCorrect || false;
        } else if (question.questionType === 'descriptive') {
          // For descriptive questions, we don't auto-grade, so no points awarded
          isCorrect = false;
        } else if (question.questionType === 'video' || question.questionType === 'photo') {
          // For media questions, we don't auto-grade, so no points awarded
          isCorrect = false;
        }

        if (isCorrect) {
          totalScore += question.points;
        }

        await tx.response.create({
          data: {
            attemptId: attempt.id,
            questionId: Number(response.questionId),
            selectedOptionId: response.optionId ? Number(response.optionId) : null,
            textResponse: response.textResponse || null,
            mediaResponse: response.mediaResponse || null
          }
        });
      }

      // Persist violations as warnings if provided
      let warningsCreated = 0;
      if (Array.isArray(violations) && violations.length > 0) {
        const warningCreates = violations.map((v) => tx.warning.create({
          data: {
            attemptId: attempt.id,
            userId: Number(userId),
            warningType: String(v?.type || 'violation'),
            // timestamp defaults to now()
          }
        }));
        await Promise.all(warningCreates);
        warningsCreated = violations.length;
      }

      // Update attempt with final score
      const updatedAttempt = await tx.attempt.update({
        where: { id: attempt.id },
        data: { 
          score: totalScore,
          status: status === 'auto_submitted' ? 'auto_submitted' : 'submitted'
        }
      });

      return {
        attempt: updatedAttempt,
        totalScore,
        maxScore,
        warningsCreated
      };
    });

    res.status(201).json({
      message: 'Quiz submitted successfully',
      attemptId: result.attempt.id,
      score: result.totalScore,
      maxScore: result.maxScore,
      violationsSaved: result.warningsCreated
    });
  } catch (error) {
    console.error('Error submitting quiz attempt:', error);
    res.status(500).json({ message: 'Failed to submit quiz attempt' });
  }
});

// ============================================================
// STUDENT ROUTES - Get Quiz Questions for Attempt
// ============================================================
router.get('/:id/questions', async (req, res) => {
  try {
    const quizId = Number(req.params.id);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        durationMinutes: true,
        questions: {
          select: {
            id: true,
            questionText: true,
            questionType: true,
            mediaUrl: true,
            points: true,
            options: {
              select: {
                id: true,
                optionText: true
                // Note: isCorrect is intentionally excluded for student view
              }
            }
          },
          orderBy: { id: 'asc' }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({
      id: quiz.id,
      title: quiz.title,
      durationMinutes: quiz.durationMinutes,
      questions: quiz.questions
    });
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    res.status(500).json({ message: 'Failed to fetch quiz questions' });
  }
});

// ============================================================
// STUDENT ROUTES - Check if student has attempted quiz
// ============================================================
router.get('/:id/attempt-status/:userId', async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const userId = Number(req.params.userId);

    const attempt = await prisma.attempt.findUnique({
      where: {
        userId_quizId: {
          userId: userId,
          quizId: quizId
        }
      },
      select: {
        id: true,
        score: true,
        submittedAt: true,
        status: true
      }
    });

    res.json({ 
      hasAttempted: !!attempt,
      attempt: attempt || null
    });
  } catch (error) {
    console.error('Error checking attempt status:', error);
    res.status(500).json({ message: 'Failed to check attempt status' });
  }
});

const sanitizeDate = (value) => (value ? new Date(value) : null);

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
};

const ensureQuestionValidity = (question, index) => {
  if (!question.questionText || typeof question.questionText !== 'string') {
    throw new Error(`Question ${index + 1} is missing text.`);
  }

  const questionType = question.questionType || 'mcq';
  const points = Number.parseInt(question.points ?? 1, 10);
  if (Number.isNaN(points) || points <= 0) {
    throw new Error(`Question ${index + 1} must have a point value greater than 0.`);
  }

  // Validate based on question type
  if (questionType === 'mcq') {
    const options = question.options ?? [];
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw new Error(`Question ${index + 1} must have between 2 and 6 options.`);
    }

    const correctCount = options.filter((opt) => opt.isCorrect).length;
    if (correctCount !== 1) {
      throw new Error(`Question ${index + 1} must have exactly one correct option.`);
    }

    options.forEach((option, optionIndex) => {
      if (!option.optionText || typeof option.optionText !== 'string') {
        throw new Error(
          `Question ${index + 1}, option ${optionIndex + 1} must include option text.`
        );
      }
    });
  } else if (questionType === 'video' || questionType === 'photo') {
    if (!question.mediaUrl || typeof question.mediaUrl !== 'string') {
      throw new Error(`Question ${index + 1} requires a ${questionType} file.`);
    }
  }
  // Descriptive questions don't need additional validation
};

const coerceToInt = (value, fallbackMessage) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(fallbackMessage);
  }
  return parsed;
};

const buildAttemptScore = (attempt) => {
  if (!attempt.responses?.length) {
    return Number(attempt.score ?? 0);
  }

  return attempt.responses.reduce((total, response) => {
    const isCorrect = response.selectedOption?.isCorrect ?? false;
    if (isCorrect) {
      return total + (response.question?.points ?? 0);
    }
    return total;
  }, 0);
};

router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      durationMinutes,
      accessPassword,
      createdBy,
      questions,
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ message: 'Quiz title is required.' });
    }

    if (!accessPassword || typeof accessPassword !== 'string') {
      return res.status(400).json({ message: 'Quiz password is required.' });
    }

    let instructorId;
    try {
      instructorId = coerceToInt(
        createdBy,
        'A valid instructor ID (createdBy) is required.'
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    let duration;
    try {
      duration = coerceToInt(
        durationMinutes,
        'Duration must be a valid number of minutes.'
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if (duration <= 0) {
      return res.status(400).json({ message: 'Duration must be greater than 0.' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'At least one question is required.' });
    }

    try {
      questions.forEach((question, index) => {
        ensureQuestionValidity(question, index);
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const createdQuiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() ?? null,
        startTime: sanitizeDate(startTime),
        endTime: sanitizeDate(endTime),
        durationMinutes: duration,
        accessPassword: accessPassword.trim(),
        createdBy: instructorId,
        questions: {
          create: questions.map((question) => ({
            questionText: question.questionText.trim(),
            questionType: question.questionType || 'mcq',
            mediaUrl: question.mediaUrl || null,
            points: coerceToInt(
              question.points ?? 1,
              'Question points must be a valid integer.'
            ),
            options: {
              create: question.options?.map((option) => ({
                optionText: option.optionText.trim(),
                isCorrect: Boolean(option.isCorrect),
              })) || [],
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: 'Quiz created successfully.',
      quiz: createdQuiz,
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    return res.status(500).json({ message: error.message || 'Failed to create quiz.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { instructorId } = req.query;
    let whereClause = {};
    if (instructorId !== undefined) {
      try {
        whereClause = {
          createdBy: coerceToInt(instructorId, 'Instructor ID must be numeric.'),
        };
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { attempts: true, questions: true },
        },
        attempts: {
          select: {
            id: true,
            score: true,
            status: true,
          },
        },
      },
    });

    const shapedQuizzes = quizzes.map((quiz) => {
      const submittedAttempts = quiz.attempts.filter(
        (attempt) => attempt.status !== 'in_progress'
      );
      const totalScore = submittedAttempts.reduce(
        (total, attempt) => total + Number(attempt.score ?? 0),
        0
      );
      const averageScore =
        submittedAttempts.length > 0
          ? Number((totalScore / submittedAttempts.length).toFixed(2))
          : 0;

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        startTime: quiz.startTime,
        endTime: quiz.endTime,
        durationMinutes: quiz.durationMinutes,
        createdAt: quiz.createdAt,
        questionCount: quiz._count.questions,
        attemptCount: quiz._count.attempts,
        averageScore,
      };
    });

    return res.json({ quizzes: shapedQuizzes });
  } catch (error) {
    console.error('Fetch quizzes error:', error);
    return res.status(500).json({ message: 'Failed to load quizzes.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let quizId;
    try {
      quizId = coerceToInt(req.params.id, 'Quiz ID must be numeric.');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: {
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { id: 'asc' },
        },
        attempts: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            responses: {
              include: {
                question: {
                  select: { id: true, points: true },
                },
                selectedOption: {
                  select: { id: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    return res.json({ quiz });
  } catch (error) {
    console.error('Fetch quiz detail error:', error);
    return res.status(500).json({ message: 'Failed to load quiz.' });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    let quizId;
    try {
      quizId = coerceToInt(req.params.id, 'Quiz ID must be numeric.');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const { format = 'csv' } = req.query;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        attempts: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            responses: {
              include: {
                question: {
                  select: { 
                    id: true, 
                    questionText: true,
                    questionType: true,
                    points: true 
                  },
                },
                selectedOption: {
                  select: { id: true, optionText: true, isCorrect: true },
                },
              },
            },
            // If Warning model exists, include it; otherwise, omit
          },
          // Do not depend on warnings count
        },
        questions: {
          include: { options: true },
          orderBy: { id: 'asc' }
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const records = quiz.attempts.map((attempt) => {
      const score = buildAttemptScore(attempt);
      // Avoid referencing warnings if the table/relation isn't present
      const violationCount = 0;
      const responses = attempt.responses.map((response) => {
        let answerText = '';
        
        if (response.question.questionType === 'mcq') {
          answerText = response.selectedOption?.optionText || 'No answer';
        } else if (response.question.questionType === 'descriptive') {
          answerText = response.textResponse || 'No answer';
        } else if (response.question.questionType === 'video' || response.question.questionType === 'photo') {
          answerText = response.mediaResponse || 'No file uploaded';
        }
        
        return {
          questionText: response.question.questionText,
          questionType: response.question.questionType,
          answer: answerText,
          points: response.question.points,
          isCorrect: response.selectedOption?.isCorrect || false
        };
      });
      
      return {
        studentName: attempt.user?.name ?? 'Unknown',
        studentEmail: attempt.user?.email ?? 'Unknown',
        status: attempt.status,
        score,
        submittedAt: attempt.submittedAt?.toISOString?.() ?? '',
        responses: responses,
        violationCount,
      };
    });

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="quiz-${quizId}-responses.html"`
      );
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Quiz Responses - ${quiz.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .attempt { border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; border-radius: 5px; }
            .student-info { background-color: #f5f5f5; padding: 10px; border-radius: 3px; margin-bottom: 15px; }
            .response { margin-bottom: 15px; padding: 10px; border-left: 3px solid #007bff; }
            .question { font-weight: bold; margin-bottom: 5px; }
            .answer { margin-left: 20px; }
            .correct { color: green; }
            .incorrect { color: red; }
            .no-answer { color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Quiz Responses: ${quiz.title}</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
      `;
      
      if (!records.length) {
        html += '<p>No attempts recorded for this quiz yet.</p>';
      } else {
        records.forEach((record, index) => {
          html += `
            <div class="attempt">
              <div class="student-info">
                <h3>Attempt #${index + 1}</h3>
                <p><strong>Student:</strong> ${record.studentName}</p>
                <p><strong>Email:</strong> ${record.studentEmail}</p>
                <p><strong>Status:</strong> ${record.status}</p>
                <p><strong>Score:</strong> ${record.score}</p>
                <p><strong>Submitted:</strong> ${record.submittedAt ? new Date(record.submittedAt).toLocaleString() : 'N/A'}</p>
                <p><strong>Violations:</strong> ${record.violationCount}</p>
              </div>
              <div class="responses">
                <h4>Responses:</h4>
          `;
          
          record.responses.forEach((response, qIndex) => {
            const answerClass = response.questionType === 'mcq' 
              ? (response.isCorrect ? 'correct' : 'incorrect')
              : '';
            const answerText = response.answer || 'No answer provided';
            
            html += `
              <div class="response">
                <div class="question">${qIndex + 1}. ${response.questionText} (${response.questionType.toUpperCase()})</div>
                <div class="answer ${answerClass}">${answerText}</div>
                ${response.questionType === 'mcq' ? `<div>Correct: ${response.isCorrect ? 'Yes' : 'No'}</div>` : ''}
                <div>Points: ${response.points}</div>
              </div>
            `;
          });
          
          html += `
              </div>
            </div>
          `;
        });
      }
      
      html += `
        </body>
        </html>
      `;
      
      return res.send(html);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="quiz-${quizId}-results.pdf"`
      );

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);

      doc.fontSize(18).text(`Quiz Results: ${quiz.title}`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      if (!records.length) {
        doc.text('No attempts recorded for this quiz yet.');
      } else {
        records.forEach((record, index) => {
          doc.font('Helvetica-Bold').text(`Attempt #${index + 1}`);
          doc.font('Helvetica').text(`Student: ${record.studentName}`);
          doc.text(`Email: ${record.studentEmail}`);
          doc.text(`Status: ${record.status}`);
          doc.text(`Score: ${record.score}`);
          doc.text(
            `Submitted At: ${record.submittedAt ? new Date(record.submittedAt).toLocaleString() : 'N/A'}`
          );
          doc.moveDown();
          
          // Add detailed responses
          doc.font('Helvetica-Bold').text('Responses:');
          record.responses.forEach((response, qIndex) => {
            doc.font('Helvetica').text(`${qIndex + 1}. ${response.questionText} (${response.questionType.toUpperCase()})`);
            doc.text(`   Answer: ${response.answer}`);
            if (response.questionType === 'mcq') {
              doc.text(`   Correct: ${response.isCorrect ? 'Yes' : 'No'}`);
            }
            doc.text(`   Points: ${response.points}`);
            doc.moveDown(0.5);
          });
          doc.moveDown();
        });
      }

      doc.end();
      return;
    }

    // Default CSV export is now question-centric per requested format
    // Columns: Question No, Question Type, Question, Points, Option
    const csvRows = [];
    csvRows.push('Question No,Question Type,Question,Points,Option');

    (quiz.questions || []).forEach((q, idx) => {
      if (q.questionType === 'mcq') {
        const opts = Array.isArray(q.options) ? q.options : [];
        if (opts.length === 0) {
          csvRows.push([
            idx + 1,
            'mcq',
            q.questionText,
            q.points,
            ''
          ].map(escapeCsvValue).join(','));
        } else {
          opts.forEach((opt) => {
            csvRows.push([
              idx + 1,
              'mcq',
              q.questionText,
              q.points,
              opt.optionText
            ].map(escapeCsvValue).join(','));
          });
        }
      } else if (q.questionType === 'descriptive') {
        csvRows.push([
          idx + 1,
          'descriptive',
          q.questionText,
          q.points,
          ''
        ].map(escapeCsvValue).join(','));
      } else {
        // Skip unsupported types like photo/video to match requested format
      }
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quiz-${quizId}-results.csv"`
    );
    return res.send(csvRows.join('\n'));
  } catch (error) {
    console.error('Export quiz results error:', error);
    return res.status(500).json({ message: 'Failed to export quiz results.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    let quizId;
    try {
      quizId = coerceToInt(req.params.id, 'Quiz ID must be numeric.');
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const {
      title,
      description,
      startTime,
      endTime,
      durationMinutes,
      accessPassword,
      questions,
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ message: 'Quiz title is required.' });
    }

    if (!accessPassword || typeof accessPassword !== 'string') {
      return res.status(400).json({ message: 'Quiz password is required.' });
    }

    let duration;
    try {
      duration = coerceToInt(
        durationMinutes,
        'Duration must be a valid number of minutes.'
      );
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if (duration <= 0) {
      return res.status(400).json({ message: 'Duration must be greater than 0.' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'At least one question is required.' });
    }

    try {
      questions.forEach((question, index) => {
        ensureQuestionValidity(question, index);
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Delete existing questions and create new ones
    await prisma.question.deleteMany({
      where: { quizId },
    });

    const updatedQuiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: title.trim(),
        description: description?.trim() ?? null,
        startTime: sanitizeDate(startTime),
        endTime: sanitizeDate(endTime),
        durationMinutes: duration,
        accessPassword: accessPassword.trim(),
        questions: {
          create: questions.map((question) => ({
            questionText: question.questionText.trim(),
            questionType: question.questionType || 'mcq',
            mediaUrl: question.mediaUrl || null,
            points: coerceToInt(
              question.points ?? 1,
              'Question points must be a valid integer.'
            ),
            options: {
              create: question.options?.map((option) => ({
                optionText: option.optionText.trim(),
                isCorrect: Boolean(option.isCorrect),
              })) || [],
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: 'Quiz updated successfully.',
      quiz: updatedQuiz,
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    return res.status(500).json({ message: error.message || 'Failed to update quiz.' });
  }
});

export default router;