import { useState } from 'react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

const evaluateExpression = (expr: string, mode: 'DEG' | 'RAD'): number => {
  const safe = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')
    .replace(/π/g, 'PI')
    .replace(/√/g, 'sqrt')
    .replace(/\u221A/g, 'sqrt');

  const toRad = (x: number) => (mode === 'DEG' ? (x * Math.PI) / 180 : x);
  const sin = (x: number) => Math.sin(toRad(x));
  const cos = (x: number) => Math.cos(toRad(x));
  const tan = (x: number) => Math.tan(toRad(x));
  const ln = (x: number) => Math.log(x);
  const log = (x: number) => Math.log10(x);
  const sqrt = (x: number) => Math.sqrt(x);
  const pow = (a: number, b: number) => Math.pow(a, b);
  const PI = Math.PI;
  const E = Math.E;

  const js = safe
    .replace(/sin\(/g, 'sin(')
    .replace(/cos\(/g, 'cos(')
    .replace(/tan\(/g, 'tan(')
    .replace(/ln\(/g, 'ln(')
    .replace(/log\(/g, 'log(')
    .replace(/sqrt\(/g, 'sqrt(')
    .replace(/PI/g, 'PI')
    .replace(/\bE\b/g, 'E');

  // eslint-disable-next-line no-new-func
  const fn = new Function('sin','cos','tan','ln','log','sqrt','pow','PI','E', `return (${js});`);
  const result = fn(sin, cos, tan, ln, log, sqrt, pow, PI, E);
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('Math error');
  return result;
};

const Calculator = ({ isOpen, onClose }: CalculatorProps) => {
  const [mode, setMode] = useState<'DEG' | 'RAD'>('DEG');
  const [display, setDisplay] = useState<string>('0');

  if (!isOpen) return null;

  const clearAll = () => setDisplay('0');
  const backspace = () => setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  const append = (token: string) => setDisplay((d) => (d === '0' ? token : d + token));
  const insert = (token: string) => setDisplay((d) => (d === '0' ? token : d + token));

  const handleEquals = () => {
    try {
      const result = evaluateExpression(display, mode);
      setDisplay(String(result));
    } catch {
      setDisplay('Error');
      setTimeout(() => setDisplay('0'), 1200);
    }
  };

  const toggleSign = () => {
    if (display.startsWith('-')) setDisplay(display.slice(1));
    else setDisplay(display === '0' ? '0' : '-' + display);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-900 text-slate-50 rounded-2xl shadow-2xl p-4 w-[360px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold opacity-80">FX-82 Scientific</h3>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <div className="bg-slate-800 rounded-lg p-3 text-right min-h-[56px]">
            <div className="text-2xl font-mono font-semibold overflow-x-auto whitespace-nowrap">
              {display}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(mode === 'DEG' ? 'RAD' : 'DEG')}
              className={`px-3 py-1 rounded text-xs font-semibold ${mode === 'DEG' ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-200'}`}
            >
              {mode}
            </button>
            <span className="text-xs opacity-70">Angle</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearAll} className="px-3 py-1 rounded bg-red-600/20 text-red-300 text-xs font-semibold hover:bg-red-600/30">AC</button>
            <button onClick={backspace} className="px-3 py-1 rounded bg-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-600">DEL</button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          <button onClick={() => insert('sin(')} className="bg-slate-800 rounded py-2 text-sm">sin</button>
          <button onClick={() => insert('cos(')} className="bg-slate-800 rounded py-2 text-sm">cos</button>
          <button onClick={() => insert('tan(')} className="bg-slate-800 rounded py-2 text-sm">tan</button>
          <button onClick={() => insert('ln(')} className="bg-slate-800 rounded py-2 text-sm">ln</button>
          <button onClick={() => insert('log(')} className="bg-slate-800 rounded py-2 text-sm">log</button>

          <button onClick={() => append('(')} className="bg-slate-800 rounded py-2 text-sm">(</button>
          <button onClick={() => append(')')} className="bg-slate-800 rounded py-2 text-sm">)</button>
          <button onClick={() => append('^2')} className="bg-slate-800 rounded py-2 text-sm">x²</button>
          <button onClick={() => append('^')} className="bg-slate-800 rounded py-2 text-sm">xʸ</button>
          <button onClick={() => insert('sqrt(')} className="bg-slate-800 rounded py-2 text-sm">√</button>

          <button onClick={() => append('π')} className="bg-slate-800 rounded py-2 text-sm">π</button>
          <button onClick={() => append('E')} className="bg-slate-800 rounded py-2 text-sm">e</button>
          <button onClick={() => setDisplay((d)=> (d==='0'?'(1/':d+'(1/'))} className="bg-slate-800 rounded py-2 text-sm">1/x</button>
          <button onClick={() => append('×')} className="bg-indigo-700/30 rounded py-2 text-sm">×</button>
          <button onClick={() => append('÷')} className="bg-indigo-700/30 rounded py-2 text-sm">÷</button>

          <button onClick={() => append('7')} className="bg-slate-700 rounded py-2 text-lg">7</button>
          <button onClick={() => append('8')} className="bg-slate-700 rounded py-2 text-lg">8</button>
          <button onClick={() => append('9')} className="bg-slate-700 rounded py-2 text-lg">9</button>
          <button onClick={() => append('-')} className="bg-indigo-700/30 rounded py-2 text-sm">−</button>
          <button onClick={toggleSign} className="bg-slate-800 rounded py-2 text-sm">+/−</button>

          <button onClick={() => append('4')} className="bg-slate-700 rounded py-2 text-lg">4</button>
          <button onClick={() => append('5')} className="bg-slate-700 rounded py-2 text-lg">5</button>
          <button onClick={() => append('6')} className="bg-slate-700 rounded py-2 text-lg">6</button>
          <button onClick={() => append('+')} className="bg-indigo-700/30 rounded py-2 text-sm">+</button>
          <button onClick={() => append('.')} className="bg-slate-800 rounded py-2 text-sm">.</button>

          <button onClick={() => append('1')} className="bg-slate-700 rounded py-2 text-lg">1</button>
          <button onClick={() => append('2')} className="bg-slate-700 rounded py-2 text-lg">2</button>
          <button onClick={() => append('3')} className="bg-slate-700 rounded py-2 text-lg">3</button>
          <button onClick={handleEquals} className="col-span-2 bg-green-600 rounded py-2 text-lg font-semibold">=</button>

          <button onClick={() => append('0')} className="col-span-5 bg-slate-700 rounded py-2 text-lg">0</button>
        </div>

        <div className="mt-3 text-center text-[10px] text-slate-400">
          Supported: sin cos tan ln log √ x² xʸ 1/x π e, DEG/RAD
        </div>
      </div>
    </div>
  );
};

export default Calculator;
