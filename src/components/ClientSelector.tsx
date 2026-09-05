import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client } from '../types';
import { formatCurrency } from '../utils/loanCalculations';
import { api } from '../services/api';
import { ClientFormModal, InitialCreditPayload } from './ClientFormModal';

export interface ClientSelectorProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  clients: Client[];
  mode?: 'bank' | 'debt';
  label?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  onClientCreated?: (newClient: Client) => void;
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  selectedClient,
  onSelectClient,
  clients,
  mode = 'debt',
  label,
  helperText,
  placeholder = 'Buscar cliente por nombre, código o teléfono...',
  disabled = false,
  onClientCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter clients (active clients with or without debt)
  const filteredClients = useMemo(() => {
    const activeClients = clients.filter((c) => c.status !== 'Desactivado');

    if (!searchQuery.trim()) {
      return activeClients.slice(0, 6);
    }

    const q = searchQuery.toLowerCase().trim();
    return activeClients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.clientNumber.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [clients, searchQuery]);

  // Keyboard navigation within autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredClients.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredClients.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
        e.preventDefault();
        const chosen = filteredClients[highlightedIndex];
        onSelectClient(chosen);
        setSearchQuery('');
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (client: Client) => {
    onSelectClient(client);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClearSelection = () => {
    onSelectClient(null);
    setSearchQuery('');
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCreateClient = async (
    clientData: Partial<Client>,
    initialCredit?: InitialCreditPayload
  ) => {
    const createdClient = await api.createClient(clientData);
    if (initialCredit && createdClient && createdClient.id) {
      if (initialCredit.debtType === 'credit' && initialCredit.capital && initialCredit.installmentsCount) {
        await api.createLoanCredit(createdClient.id, {
          capital: initialCredit.capital,
          interestRate: initialCredit.interestRate || 0,
          interestAmount: initialCredit.interestAmount || 0,
          totalAmount: initialCredit.totalAmount || initialCredit.capital,
          installmentsCount: initialCredit.installmentsCount,
          installmentAmount: initialCredit.installmentAmount || 0,
          frequency: initialCredit.frequency || 'Mensual',
          firstDueDate: initialCredit.firstDueDate || new Date().toISOString().split('T')[0],
          notes: 'Crédito inicial otorgado al registrar cliente',
        });
      } else if (initialCredit.debtType === 'simple' && initialCredit.simpleAmount) {
        await api.addCreditPurchase(createdClient.id, {
          product: initialCredit.simpleConcept || 'Saldo inicial de apertura',
          unitPrice: initialCredit.simpleAmount,
          quantity: 1,
        });
      }
    }

    onSelectClient(createdClient);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setShowNewClientModal(false);

    if (onClientCreated) {
      onClientCreated(createdClient);
    }
  };

  const defaultLabel = mode === 'bank' ? 'Seleccionar Cliente *' : 'Cliente Destino *';
  const defaultHelperText =
    mode === 'bank'
      ? 'Puedes seleccionar cualquier cliente activo, tenga o no créditos previos.'
      : 'Puedes seleccionar cualquier cliente activo, tenga o no deuda pendiente.';

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-xs font-bold text-slate-700">
        {label || defaultLabel}
      </label>

      {/* State 1: Client is Selected -> Compact Non-Editable Summary Card */}
      {selectedClient ? (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs bg-indigo-600">
              {selectedClient.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {selectedClient.name}
                </span>
                <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-semibold">
                  {selectedClient.clientNumber}
                </span>
              </div>

              {/* Financial Summary per Mode */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-medium mt-0.5">
                {selectedClient.phone && (
                  <span className="flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[13px] text-slate-400">phone</span>
                    <span>{selectedClient.phone}</span>
                  </span>
                )}

                {mode === 'bank' ? (
                  <>
                    <span>
                      Límite:{' '}
                      <strong className="text-slate-700 font-mono">
                        {selectedClient.creditLimit > 0
                          ? formatCurrency(selectedClient.creditLimit)
                          : 'Sin límite'}
                      </strong>
                    </span>
                    <span>
                      Deuda banco:{' '}
                      <strong className={`font-mono ${(selectedClient.bankDebtBalance ?? 0) > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {formatCurrency(selectedClient.bankDebtBalance ?? 0)}
                      </strong>
                    </span>
                    <span>
                      Saldo actual:{' '}
                      <strong className={`font-mono ${selectedClient.currentBalance > 0.01 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {formatCurrency(selectedClient.currentBalance)}
                      </strong>
                    </span>
                    <span>
                      Disponible:{' '}
                      <strong className={`font-mono ${
                        selectedClient.availableCredit !== null && selectedClient.availableCredit <= 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}>
                        {selectedClient.availableCredit !== null
                          ? formatCurrency(selectedClient.availableCredit)
                          : 'Sin límite'}
                      </strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Límite:{' '}
                      <strong className="text-slate-700 font-mono">
                        {selectedClient.creditLimit > 0
                          ? formatCurrency(selectedClient.creditLimit)
                          : 'Sin límite'}
                      </strong>
                    </span>
                    <span>
                      Debe:{' '}
                      <strong className={`font-mono ${(selectedClient.dailyDebtBalance ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {(selectedClient.dailyDebtBalance ?? 0) > 0
                          ? formatCurrency(selectedClient.dailyDebtBalance)
                          : (selectedClient.dailyDebtBalance ?? 0) < 0
                          ? `-S/ ${Math.abs(selectedClient.dailyDebtBalance).toFixed(2)} (A favor)`
                          : 'S/ 0.00 (Al día)'}
                      </strong>
                    </span>
                    <span>
                      Disponible:{' '}
                      <strong className={`font-mono ${
                        selectedClient.availableCredit !== null && selectedClient.availableCredit <= 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}>
                        {selectedClient.availableCredit !== null
                          ? formatCurrency(selectedClient.availableCredit)
                          : 'Sin límite'}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action to change client */}
          {!disabled && (
            <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Cambiar a otro cliente"
              >
                <span className="material-symbols-outlined text-[15px] text-slate-500">swap_horiz</span>
                <span>Cambiar cliente</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* State 2: Autocomplete Search Input + "+ Nuevo Cliente" */
        <div className="space-y-1.5 relative">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                ref={inputRef}
                id="client-selector-input"
                type="text"
                value={searchQuery}
                disabled={disabled}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label={label || defaultLabel}
                aria-autocomplete="list"
                className="w-full h-10 pl-9 pr-8 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs placeholder:text-slate-400 disabled:bg-slate-100"
                autoFocus
              />
              {searchQuery && !disabled && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsDropdownOpen(true);
                    setHighlightedIndex(-1);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              )}
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={() => setShowNewClientModal(true)}
                className="h-10 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs whitespace-nowrap"
                title="Registrar un nuevo cliente en el sistema"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>+ Nuevo Cliente</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            {helperText || defaultHelperText}
          </p>

          {/* Floating Dropdown */}
          {isDropdownOpen && !disabled && (
            <div
              role="listbox"
              aria-label="Resultados de clientes"
              className="absolute left-0 right-0 top-full mt-1 z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 shadow-xl"
            >
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-xs space-y-2.5">
                  <p className="text-slate-500 font-medium">
                    No se encontraron clientes para:<br />
                    <span className="font-bold text-slate-800 text-sm">"{searchQuery}"</span>
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowNewClientModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                      <span>+ Crear nuevo cliente</span>
                    </button>
                  </div>
                </div>
              ) : (
                filteredClients.map((c, idx) => {
                  const hasDebt = (c.dailyDebtBalance ?? 0) > 0;
                  const limit = c.creditLimit || 0;
                  const available = c.availableCredit != null ? c.availableCredit : (limit > 0 ? Math.max(0, limit - (c.creditExposure ?? c.currentBalance)) : null);

                  return (
                    <div
                      key={c.id}
                      role="option"
                      aria-selected={idx === highlightedIndex}
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-3 px-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                        idx === highlightedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {c.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                            {c.clientNumber}
                          </span>
                        </div>
                        {c.phone && (
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">phone</span>
                            <span>{c.phone}</span>
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0 text-xs">
                        {mode === 'bank' ? (
                          <>
                            <div className="font-mono font-bold text-slate-800">
                              Límite: {limit > 0 ? formatCurrency(limit) : 'Sin límite'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Banco: <span className="font-mono font-semibold">{formatCurrency(c.bankDebtBalance ?? 0)}</span>
                            </div>
                            <div className="text-[10px] mt-0.5 font-medium">
                              {limit > 0 ? (
                                available !== null && available > 0 ? (
                                  <span className="text-emerald-600 font-semibold font-mono">
                                    Disp: {formatCurrency(available)}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-semibold font-mono">
                                    Disp: S/ 0.00
                                  </span>
                                )
                              ) : (
                                <span className="text-emerald-600 font-semibold">
                                  Disp: Sin límite
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-xs font-extrabold">
                              {hasDebt ? (
                                <span className="text-rose-600">Debe: {formatCurrency(c.dailyDebtBalance ?? 0)}</span>
                              ) : (c.dailyDebtBalance ?? 0) < 0 ? (
                                <span className="text-blue-600">A favor: -S/ {Math.abs(c.dailyDebtBalance).toFixed(2)}</span>
                              ) : (
                                <span className="text-emerald-600">Al día (S/ 0.00)</span>
                              )}
                            </div>
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              Límite: {limit > 0 ? formatCurrency(limit) : 'Sin límite'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Embedded Client Creation Modal (layered with high z-index) */}
      {showNewClientModal && (
        <ClientFormModal
          isOpen={showNewClientModal}
          onClose={() => setShowNewClientModal(false)}
          onSubmit={handleCreateClient}
          initialClient={null}
          zIndexClass="z-[60]"
        />
      )}
    </div>
  );
};
