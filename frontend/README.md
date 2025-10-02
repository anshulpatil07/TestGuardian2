# Guardian Frontend

React + TypeScript dashboard for Guardian's proctoring platform. The instructor dashboard allows quiz creation, question authoring, and review of historical quizzes with exportable results.

## Getting Started

```bash
npm install
npm run dev
```

Set the backend API location with a Vite environment variable (defaults to `http://localhost:5000`). Create a `.env` file if you need to override it:

```
VITE_BACKEND_URL=http://localhost:5000
```

## Instructor Dashboard Features

- Create quizzes with title, description, optional start/end schedule, duration, and access password.
- Author multiple-choice questions with 2–6 options, a single correct answer, and custom point values.
- Review previously created quizzes with key metrics (question count, attempts, average score, time window).
- Export quiz results as CSV or PDF directly from the dashboard.

## API Endpoints Used

- `POST /api/quiz` – create a quiz with nested questions and options.
- `GET /api/quiz?instructorId=` – fetch quizzes created by the signed-in instructor.
- `GET /api/quiz/:id/export?format=csv|pdf` – download results for offline analysis.

The sign-in flow stores the authenticated instructor in `localStorage` under the `guardian_user` key. The dashboard requires that state to load.
