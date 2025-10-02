
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center text-white">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-12 shadow-lg text-center space-y-8 max-w-md">
        <h1 className="text-5xl font-extrabold tracking-tight">Welcome to Test Guardian</h1>
        <p className="text-lg opacity-80">Your one-stop solution to create, manage, and monitor tests securely.</p>
        
        <div className="space-y-4">
          <button
            onClick={() => navigate('/signin')}
            className="w-full py-3 px-6 bg-blue-600 rounded-xl text-white font-semibold hover:bg-blue-700 shadow-lg transition-all transform hover:scale-105"
          >
            Sign In
          </button>
          
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-3 px-6 bg-green-500 rounded-xl text-white font-semibold hover:bg-green-600 shadow-lg transition-all transform hover:scale-105"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
