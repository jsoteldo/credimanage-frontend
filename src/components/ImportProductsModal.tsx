import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { ImportProductsResult } from '../types';
import * as XLSX from 'xlsx';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zIndexClass?: string;
}

export const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  zIndexClass = 'z-50',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportProductsResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Codigo: 'PROD-001',
        CodigoBarras: '7591234567890',
        Descripcion: 'Arroz Blanco Extra 1kg',
        PrecioCosto: 0.85,
        PrecioVenta: 1.20,
        PrecioMayoreo: 1.10,
        InvMinimo: 10,
        Departamento: 'Granos y Cereales',
        Existencia: 50,
      },
      {
        Codigo: 'PROD-002',
        CodigoBarras: '',
        Descripcion: 'Queso Paisa (Granel)',
        PrecioCosto: 4.00,
        PrecioVenta: 5.50,
        PrecioMayoreo: 5.00,
        InvMinimo: 5,
        Departamento: 'Lácteos',
        Existencia: 20,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PlantillaProductos');
    XLSX.writeFile(wb, 'plantilla_importacion_productos.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setImportResult(null);

    // Client-side preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setPreviewRows(data.slice(0, 10)); // Preview first 10
      } catch (err: any) {
        setError('No se pudo leer el archivo Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona un archivo Excel o CSV');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await api.importProductsFile(formData);
      setImportResult(result);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar la importación');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewRows([]);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm ${zIndexClass}`}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <span className="material-symbols-outlined text-[22px]">upload_file</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                Importar Productos desde Excel
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Carga masiva de catálogo, actualización de precios y departamentos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Important Notice */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>Aviso Importante sobre Existencias / Stock</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Si tu Excel contiene la columna <strong>Existencia</strong>, será leída para validación pero{' '}
              <strong>NO alterará el stock físico</strong> en esta primera entrega. El control de existencias
              mediante movimientos de inventario y kardex se activará formalmente en la Entrega 2.
            </p>
          </div>

          {/* Template Download & File Upload Buttons */}
          {!importResult && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">¿No tienes el formato exacto?</h4>
                  <p className="text-[11px] text-slate-500">
                    Descarga la plantilla con las columnas estandarizadas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">file_download</span>
                  <span>Descargar Plantilla Excel</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-3xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Haz clic o arrastra tu archivo Excel aquí'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Soporta formatos .xlsx, .xls y .csv</p>
              </div>

              {/* Preview */}
              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Vista previa de datos detectados (Primeras {previewRows.length} filas):
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                        <tr>
                          {Object.keys(previewRows[0]).map((k) => (
                            <th key={k} className="p-2 border-b border-slate-200 truncate">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {Object.values(r).map((val: any, j) => (
                              <td key={j} className="p-2 text-slate-700 font-mono text-[11px] truncate max-w-[120px]">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Display */}
          {importResult && (
            <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
                <span>Proceso de importación finalizado</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xl font-black text-emerald-600">{importResult.createdCount}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Nuevos Creados</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xl font-black text-indigo-600">{importResult.updatedCount}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Actualizados</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xl font-black text-amber-600">{importResult.departmentsCreated}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Departamentos</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <div className="text-xl font-black text-rose-600">{importResult.errors.length}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Errores</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-rose-700 uppercase">Detalle de errores:</h5>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-white rounded-xl border border-rose-100 text-[11px] text-rose-600">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx}>
                        • Fila {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
          {importResult ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cargar otro archivo
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              {selectedFile ? `Archivo: ${selectedFile.name}` : 'Selecciona un archivo para continuar'}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            >
              {importResult ? 'Cerrar' : 'Cancelar'}
            </button>
            {!importResult && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={loading || !selectedFile}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {loading ? 'hourglass_top' : 'publish'}
                </span>
                <span>{loading ? 'Procesando...' : 'Iniciar Importación'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
