import React, { useState } from 'react';
import { User } from '../types';
import { api, setAuthToken } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login(email, password);
      setAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 mx-auto mb-3">
            <span className="material-symbols-outlined text-[28px]">point_of_sale</span>
          </div>
          <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight">CrediManage POS</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Inicio de sesión obligatorio</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-900 border border-rose-200/80 rounded-xl text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-950 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-950 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-2 text-xs"
          >
            <span className="material-symbols-outlined text-[18px]">key</span>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>



        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-slate-500 font-medium text-xs">
            ¿No tienes cuenta?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              Registrarme
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
