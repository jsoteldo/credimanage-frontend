import React, { useState, useEffect, useRef } from 'react';
import { User, WhatsAppReminderConfig } from '../types';
import { api } from '../services/api';
import {
  ALLOWED_WHATSAPP_REMINDER_VARIABLES,
  VARIABLE_DESCRIPTIONS,
  SIMULATED_PREVIEW_CLIENT,
  validateTemplateVariables,
  interpolateWhatsAppTemplate,
  DEFAULT_WHATSAPP_REMINDER_TEMPLATE,
} from '../utils/whatsappReminder';

interface WhatsAppReminderConfigViewProps {
  currentUser: User | null;
}

export const WhatsAppReminderConfigView: React.FC<WhatsAppReminderConfigViewProps> = ({
  currentUser,
}) => {
  const [config, setConfig] = useState<WhatsAppReminderConfig | null>(null);
  const [template, setTemplate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAdmin = currentUser?.role === 'Administrador';

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWhatsAppReminderConfig();
      setConfig(data);
      setTemplate(data.template);
    } catch (err: any) {
      setError(err.message || 'Error al cargar la plantilla de recordatorio');
      setTemplate(DEFAULT_WHATSAPP_REMINDER_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Validation
  const validation = validateTemplateVariables(template);
  const previewText = interpolateWhatsAppTemplate(template, SIMULATED_PREVIEW_CLIENT);
  const hasChanges = config ? template !== config.template : false;

  const handleInsertVariable = (variable: string) => {
    if (!isAdmin) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      setTemplate((prev) => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = template;
    const newText =
      currentText.substring(0, start) + variable + currentText.substring(end);
    setTemplate(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variable.length,
        start + variable.length,
      );
    }, 0);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!validation.isValid) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await api.updateWhatsAppReminderConfig(template);
      setConfig(updated);
      setTemplate(updated.template);
      setSuccessMessage('Plantilla guardada correctamente en el sistema.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRestore = () => {
    const defaultText = config?.defaultTemplate || DEFAULT_WHATSAPP_REMINDER_TEMPLATE;
    setTemplate(defaultText);
    setShowConfirmRestore(false);
    setSuccessMessage(
      'Mensaje predeterminado restaurado en el editor. Pulsa "Guardar Configuración" para persistir el cambio.',
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white py-3.5 px-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <span className="material-symbols-outlined text-[24px]">chat</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Configuración de Mensajes
              </span>
              <span className="text-[10px] font-bold text-slate-300">•</span>
              <span className="text-[10px] font-bold text-emerald-600">WhatsApp</span>
            </div>
            <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
              Recordatorio de Cobranza por WhatsApp
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Plantilla global configurable utilizada al enviar recordatorios de cobranza a clientes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {config?.isDefault ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              Plantilla Predeterminada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Plantilla Personalizada
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0">
            error
          </span>
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
            check_circle
          </span>
          <span className="flex-1">{successMessage}</span>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">
            lock
          </span>
          <span>
            Modo solo lectura: Solo los usuarios con rol <strong>Administrador</strong> tienen permisos para modificar o restaurar la plantilla de recordatorio de cobranza.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
          <span className="material-symbols-outlined animate-spin text-[32px] text-indigo-600">
            sync
          </span>
          <p className="mt-2 text-xs font-medium">Cargando configuración de plantilla...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ROW 1: Editor (60%) + Variables disponibles (40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            {/* Editor Column (60% on desktop: col-span-3 of 5) */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="templateEditor"
                    className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">
                      edit_note
                    </span>
                    Editor de Plantilla
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {template.length} caracteres
                  </span>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    id="templateEditor"
                    ref={textareaRef}
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    disabled={!isAdmin || saving}
                    rows={8}
                    placeholder="Escribe aquí la plantilla de mensaje..."
                    className={`w-full p-3.5 rounded-xl border font-sans text-xs md:text-sm text-slate-800 leading-relaxed outline-none transition-all resize-y ${
                      !validation.isValid
                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20'
                        : 'border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/40'
                    }`}
                  />
                </div>

                {/* Validation Warning */}
                {!validation.isValid && (
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
                    <span className="material-symbols-outlined text-[17px] text-rose-600 shrink-0 mt-0.5">
                      warning
                    </span>
                    <div>
                      {validation.invalidVariables.length === 1 ? (
                        <p>
                          Variable no reconocida: <strong>{validation.invalidVariables[0]}</strong>
                        </p>
                      ) : (
                        <p>
                          Variables no reconocidas:{' '}
                          <strong>{validation.invalidVariables.join(', ')}</strong>
                        </p>
                      )}
                      <p className="text-[11px] font-normal text-rose-600 mt-0.5">
                        Corrige o elimina las variables no válidas para poder guardar la plantilla.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isAdmin && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRestore(true)}
                    disabled={saving}
                    className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200/80 shadow-2xs"
                    title="Restaurar la plantilla predeterminada del sistema"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    Restaurar mensaje predeterminado
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !validation.isValid || (!hasChanges && !config?.isDefault)}
                    className={`w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      !validation.isValid || saving
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                    }`}
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        Guardar Configuración
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Compact Variables Column (40% on desktop: col-span-2 of 5) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-indigo-600">
                      data_object
                    </span>
                    Variables disponibles
                  </h4>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    7 campos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mb-2.5">
                  Haz clic en <strong>Insertar</strong> para agregar la etiqueta en el cursor.
                </p>

                {/* Compact List of Variables */}
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs bg-slate-50/20">
                  {ALLOWED_WHATSAPP_REMINDER_VARIABLES.map((v) => (
                    <div
                      key={v}
                      className="px-2.5 py-1.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <code className="text-indigo-700 font-mono font-bold text-[11px] bg-indigo-50/80 px-1 py-0.5 rounded border border-indigo-100">
                            {v}
                          </code>
                          <span className="text-[11px] text-slate-500 font-medium truncate">
                            {VARIABLE_DESCRIPTIONS[v] || ''}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleInsertVariable(v)}
                          className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100 bg-indigo-50/80 border border-indigo-200/70 rounded-md transition-colors cursor-pointer shrink-0 flex items-center gap-0.5"
                          title={`Insertar ${v} en la plantilla`}
                        >
                          <span className="material-symbols-outlined text-[13px]">add</span>
                          Insertar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-medium pt-1">
                Los saldos se toman de los balances reales entregados por el backend.
              </p>
            </div>
          </div>

          {/* ROW 2: Full-Width Live Preview Card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">
                  visibility
                </span>
                Vista previa en tiempo real
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Simulación de WhatsApp
              </span>
            </div>

            {/* Compact Simulation Info Line */}
            <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                <span className="material-symbols-outlined text-[14px] text-indigo-500">science</span>
                Simulación:
              </span>
              <span className="font-semibold text-slate-900">Juan Pérez</span>
              <span className="text-slate-300">·</span>
              <span>
                Deuda Corriente: <strong className="font-mono text-slate-700">S/ 300.00</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Deuda Bancaria: <strong className="font-mono text-slate-700">S/ 700.00</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Saldo Consolidado:{' '}
                <strong className="font-mono text-emerald-700">S/ 1,000.00</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Próximo Pago: <strong className="font-mono text-slate-700">15/10/2026</strong>
              </span>
            </div>

            {/* WhatsApp Message Preview Bubble in Full Width Container */}
            <div className="p-4 md:p-5 bg-emerald-50/40 rounded-2xl border border-emerald-100 flex justify-center">
              <div className="w-full max-w-2xl bg-white rounded-2xl p-4 shadow-xs border border-emerald-100 space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    CM
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">CrediManage</p>
                    <p className="text-[10px] text-slate-400">Recordatorio de Cobranza</p>
                  </div>
                </div>

                <p className="text-xs md:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {previewText || (
                    <span className="italic text-slate-400">
                      La plantilla está vacía. Escribe texto en el editor para previsualizar.
                    </span>
                  )}
                </p>

                <div className="text-right text-[10px] text-slate-400 font-mono pt-1">
                  10:30 a. m. • Enviado
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore */}
      {showConfirmRestore && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Restaurar mensaje predeterminado
                </h4>
                <p className="text-xs text-slate-500">
                  Se reemplazará el contenido del editor por la plantilla base original.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <strong>Nota:</strong> Esta acción no guardará el cambio en la base de datos automáticamente. Podrás revisarlo antes de pulsar <em>Guardar Configuración</em>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRestore(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer"
              >
                Sí, restaurar plantilla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
