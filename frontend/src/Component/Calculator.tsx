import { useState } from 'react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const Calculator = ({ isOpen, onClose }: CalculatorProps) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Calculator</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Display */}
        <div className="mb-4">
          <div className="bg-slate-100 rounded-lg p-4 text-right">
            <div className="text-2xl font-mono font-semibold text-slate-900 overflow-hidden">
              {display}
            </div>
          </div>
        </div>

        {/* Calculator Buttons */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button
            onClick={clear}
            className="col-span-2 bg-red-100 text-red-700 rounded-lg p-3 font-semibold hover:bg-red-200 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => performOperation('÷')}
            className="bg-indigo-100 text-indigo-700 rounded-lg p-3 font-semibold hover:bg-indigo-200 transition-colors"
          >
            ÷
          </button>
          <button
            onClick={() => performOperation('×')}
            className="bg-indigo-100 text-indigo-700 rounded-lg p-3 font-semibold hover:bg-indigo-200 transition-colors"
          >
            ×
          </button>

          {/* Row 2 */}
          <button
            onClick={() => inputNumber('7')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            7
          </button>
          <button
            onClick={() => inputNumber('8')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            8
          </button>
          <button
            onClick={() => inputNumber('9')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            9
          </button>
          <button
            onClick={() => performOperation('-')}
            className="bg-indigo-100 text-indigo-700 rounded-lg p-3 font-semibold hover:bg-indigo-200 transition-colors"
          >
            −
          </button>

          {/* Row 3 */}
          <button
            onClick={() => inputNumber('4')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            4
          </button>
          <button
            onClick={() => inputNumber('5')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            5
          </button>
          <button
            onClick={() => inputNumber('6')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            6
          </button>
          <button
            onClick={() => performOperation('+')}
            className="bg-indigo-100 text-indigo-700 rounded-lg p-3 font-semibold hover:bg-indigo-200 transition-colors"
          >
            +
          </button>

          {/* Row 4 */}
          <button
            onClick={() => inputNumber('1')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            1
          </button>
          <button
            onClick={() => inputNumber('2')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            2
          </button>
          <button
            onClick={() => inputNumber('3')}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            3
          </button>
          <button
            onClick={handleEquals}
            className="row-span-2 bg-green-100 text-green-700 rounded-lg p-3 font-semibold hover:bg-green-200 transition-colors"
          >
            =
          </button>

          {/* Row 5 */}
          <button
            onClick={() => inputNumber('0')}
            className="col-span-2 bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            0
          </button>
          <button
            onClick={inputDecimal}
            className="bg-slate-100 text-slate-700 rounded-lg p-3 font-semibold hover:bg-slate-200 transition-colors"
          >
            .
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            Use this calculator for mathematical calculations during your quiz
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
