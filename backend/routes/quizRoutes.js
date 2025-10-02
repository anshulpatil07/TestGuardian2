import express from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../db/prisma.js';

const router = express.Router();

const sanitizeDate = (value) => (value ? new Date(value) : null);

const ensureQuestionValidity = (question, index) => {
  if (!question.questionText || typeof question.questionText !== 'string') {
    throw new Error(`Question ${index + 1} is missing text.`);
  }

  const options = question.options ?? [];
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
    throw new Error(`Question ${index + 1} must have between 2 and 6 options.`);
  }

  const correctCount = options.filter((opt) => opt.isCorrect).length;
  if (correctCount !== 1) {
    throw new Error(`Question ${index + 1} must have exactly one correct option.`);
  }

  const points = Number.parseInt(question.points ?? 1, 10);
  if (Number.isNaN(points) || points <= 0) {
    throw new Error(`Question ${index + 1} must have a point value greater than 0.`);
  }

  options.forEach((option, optionIndex) => {
    if (!option.optionText || typeof option.optionText !== 'string') {
      throw new Error(
        `Question ${index + 1}, option ${optionIndex + 1} must include option text.`
      );
    }
  });
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
            points: coerceToInt(
              question.points ?? 1,
              'Question points must be a valid integer.'
            ),
            options: {
              create: question.options.map((option) => ({
                optionText: option.optionText.trim(),
                isCorrect: Boolean(option.isCorrect),
              })),
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

    const records = quiz.attempts.map((attempt) => {
      const score = buildAttemptScore(attempt);
      return {
        studentName: attempt.user?.name ?? 'Unknown',
        studentEmail: attempt.user?.email ?? 'Unknown',
        status: attempt.status,
        score,
        submittedAt: attempt.submittedAt?.toISOString?.() ?? '',
      };
    });

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
        });
      }

      doc.end();
      return;
    }

    // Default CSV export
    const header = 'Student Name,Student Email,Status,Score,Submitted At';
    const csvRows = records.map((record) =>
      [
        record.studentName,
        record.studentEmail,
        record.status,
        record.score,
        record.submittedAt,
      ]
        .map((value) => {
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          return /[",\n]/.test(stringValue)
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        })
        .join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quiz-${quizId}-results.csv"`
    );
    return res.send([header, ...csvRows].join('\n'));
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
            points: coerceToInt(
              question.points ?? 1,
              'Question points must be a valid integer.'
            ),
            options: {
              create: question.options.map((option) => ({
                optionText: option.optionText.trim(),
                isCorrect: Boolean(option.isCorrect),
              })),
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