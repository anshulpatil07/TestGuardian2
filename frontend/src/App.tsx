import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import StudentDashboard from './pages/StudentDashboard';
import InstructorDashboard from './pages/InstructorDashboard';
import QuizAttempt from './pages/QuizAttempt';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/instructor-dashboard" element={<InstructorDashboard />} />
        <Route path="/quiz-attempt/:quizId" element={<QuizAttempt />} />
      </Routes>
    </Router>
  );
}

export default App;
