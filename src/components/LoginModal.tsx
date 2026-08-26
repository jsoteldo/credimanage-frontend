import React, { useState } from 'react';
import { User } from '../types';
import { api, setAuthToken } from '../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('admin@credimanage.pos');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login(email, password);
      setAuthToken(res.token);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación JWT');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs flex items-center justify-center z-50 p-md">
      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-2xl max-w-md w-full p-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-md pb-sm border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">lock</span>
            </div>
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">Autenticación JWT POS</h3>
              <p className="font-body-sm text-secondary text-xs">Acceso seguro con token de sesión</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-on-surface p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-md p-sm bg-error-container text-on-error-container border border-error/30 rounded text-body-sm flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-md">
          <div>
            <label className="block font-label-md text-on-surface-variant mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@credimanage.pos"
              className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-bright font-data-mono text-body-md"
            />
          </div>

          <div>
            <label className="block font-label-md text-on-surface-variant mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-sm border border-outline-variant rounded bg-surface-bright font-data-mono text-body-md"
            />
          </div>

          {/* Quick Login Buttons */}
          <div className="p-sm bg-surface-container-low rounded border border-outline-variant space-y-xs">
            <p className="font-label-md text-[11px] text-secondary font-bold">CUENTAS DEMO RÁPIDAS:</p>
            <div className="flex gap-sm">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@credimanage.pos', 'admin123')}
                className="flex-1 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-label-md text-[11px] font-bold cursor-pointer transition-colors"
              >
                1-Click Administrador
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('cajero@credimanage.pos', 'cajero123')}
                className="flex-1 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-label-md text-[11px] font-bold cursor-pointer transition-colors"
              >
                1-Click Cajero
              </button>
            </div>
          </div>

          <div className="pt-md border-t border-outline-variant flex justify-end gap-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-md py-sm border border-outline-variant rounded text-on-surface font-label-md cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-lg py-sm bg-primary text-on-primary rounded font-label-md font-bold hover:bg-primary-container transition-colors cursor-pointer shadow-sm flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[18px]">key</span>
              {loading ? 'Validando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
