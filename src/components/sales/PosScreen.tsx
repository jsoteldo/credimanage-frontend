import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Product, Location, Client, CreateSalePayload, Sale, CashSession, User } from '../../types';
import { formatCurrency } from '../../utils/loanCalculations';
import { api } from '../../services/api';
import { ClientSelector } from '../ClientSelector';
import { CheckoutModal } from './CheckoutModal';
import { SaleSuccessModal } from './SaleSuccessModal';
import { OpenCashModal } from '../cash/OpenCashModal';

export interface CartLine {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  saleType: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  minimumStock: number;
}

interface PosScreenProps {
  locations: Location[];
  products: Product[];
  clients: Client[];
  currentUser?: User | null;
  onSaleCreated?: (sale: Sale) => void;
  onViewSalesHistory?: () => void;
  onRefreshData?: () => void;
  onNavigateToStoreRegisters?: (storeId: string) => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({
  locations,
  products,
  clients,
  currentUser,
  onSaleCreated,
  onViewSalesHistory,
  onRefreshData,
  onNavigateToStoreRegisters,
}) => {
  // Filter active stores only
  const storeLocations = useMemo(() => {
    return locations.filter((loc) => loc.active && (loc.type === 'STORE' || !loc.type));
  }, [locations]);

  // Selected Store
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    return storeLocations.length > 0 ? storeLocations[0].id : '';
  });

  useEffect(() => {
    if ((!selectedStoreId || !storeLocations.some((s) => s.id === selectedStoreId)) && storeLocations.length > 0) {
      setSelectedStoreId(storeLocations[0].id);
    }
  }, [storeLocations, selectedStoreId]);

  const selectedStore = useMemo(() => {
    return storeLocations.find((s) => s.id === selectedStoreId) || null;
  }, [storeLocations, selectedStoreId]);

  // Store stocks state (storeId -> Map<productId, { quantity, minimumStock }>)
  const [storeStocks, setStoreStocks] = useState<
    Map<string, { quantity: number; minimumStock: number }>
  >(new Map());
  const [loadingStocks, setLoadingStocks] = useState<boolean>(false);

  // Load stocks for selected store
  useEffect(() => {
    if (!selectedStoreId) return;

    let isMounted = true;
    setLoadingStocks(true);

    api
      .getInventoryStock({ locationId: selectedStoreId })
      .then((items) => {
        if (!isMounted) return;
        const stockMap = new Map<string, { quantity: number; minimumStock: number }>();
        items.forEach((item) => {
          stockMap.set(item.productId, {
            quantity: item.quantity,
            minimumStock: item.minimumStock,
          });
        });
        setStoreStocks(stockMap);
      })
      .catch((err) => {
        console.error('Error fetching store stock in POS:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingStocks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStoreId]);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);

  // Client state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSelector, setShowClientSelector] = useState<boolean>(false);

  // Search / Barcode state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const dropdownItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Modals state
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [showOpenCashModal, setShowOpenCashModal] = useState<boolean>(false);

  // Cash Session State (Etapa 3)
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(null);
  const [loadingCashSession, setLoadingCashSession] = useState<boolean>(false);

  const loadCashSession = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingCashSession(true);
    try {
      const sess = await api.getCurrentCashSession(selectedStoreId);
      setActiveCashSession(sess);
    } catch {
      setActiveCashSession(null);
    } finally {
      setLoadingCashSession(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    loadCashSession();
  }, [loadCashSession]);

  // Focus search input on mount and after actions
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter searchable products (active only, excluding inactive components)
  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter((p) => p.active);
    if (!searchQuery.trim()) {
      return [];
    }

    const q = searchQuery.toLowerCase().trim();
    return activeProducts
      .filter((p) => {
        const matchSku = p.sku?.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.toLowerCase().includes(q);
        const matchName = p.name?.toLowerCase().includes(q);
        return matchSku || matchBarcode || matchName;
      })
      .slice(0, 8);
  }, [products, searchQuery]);

  // Add product to cart helper
  const addProductToCart = (product: Product, quantityToAdd = 1) => {
    const intQtyToAdd = Math.max(1, Math.floor(quantityToAdd));
    const stockInfo = storeStocks.get(product.id) || {
      quantity: 0,
      minimumStock: Number(product.defaultMinStock || 0),
    };

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + intQtyToAdd;
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal: Math.round(newQty * existing.unitPrice * 100) / 100,
        };
        return updated;
      } else {
        const unitPrice = Number(product.salePrice);
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            barcode: product.barcode,
            saleType: product.saleType,
            unitPrice,
            quantity: intQtyToAdd,
            lineTotal: Math.round(intQtyToAdd * unitPrice * 100) / 100,
            availableStock: stockInfo.quantity,
            minimumStock: stockInfo.minimumStock,
          },
        ];
      }
    });

    // Reset search & refocus input
    setSearchQuery('');
    setIsSearchDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Barcode / Fast Input Keyboard Handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchDropdownOpen(true);
      setHighlightedIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchDropdownOpen(true);
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredProducts.length - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // 1. Check if an item in dropdown is highlighted
      if (
        isSearchDropdownOpen &&
        highlightedIndex >= 0 &&
        highlightedIndex < filteredProducts.length
      ) {
        addProductToCart(filteredProducts[highlightedIndex]);
        return;
      }

      // 2. Barcode reader fast match: check exact barcode or SKU match
      const exactMatch = products.find(
        (p) =>
          p.active &&
          ((p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase())),
      );

      if (exactMatch) {
        addProductToCart(exactMatch);
        return;
      }

      // 3. Fallback: if dropdown has exactly 1 match, add it
      if (filteredProducts.length === 1) {
        addProductToCart(filteredProducts[0]);
        return;
      }

      // Open dropdown if there are multiple matches
      if (filteredProducts.length > 0) {
        setIsSearchDropdownOpen(true);
        setHighlightedIndex(0);
      }
    } else if (e.key === 'Escape') {
      setIsSearchDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Cart operations
  const updateCartQuantity = (productId: string, newQty: number) => {
    const intQty = Math.floor(newQty);
    if (intQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: intQty,
              lineTotal: Math.round(intQty * item.unitPrice * 100) / 100,
            }
          : item,
      ),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    searchInputRef.current?.focus();
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setShowClientSelector(false);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    return (
      Math.round(
        cart.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0) * 100,
      ) / 100
    );
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Confirm Sale Execution (Supports Create or Update Sale)
  const handleConfirmSale = async (payload: CreateSalePayload) => {
    let sale: Sale;
    if (editingSale) {
      sale = await api.updateSale(editingSale.id, payload);
      setEditingSale(null);
    } else {
      sale = await api.createSale(payload);
    }
    setCompletedSale(sale);
    setShowCheckoutModal(false);

    if (onSaleCreated) {
      onSaleCreated(sale);
    }
    if (onRefreshData) {
      onRefreshData();
    }
  };

  // Reset for New Sale
  const handleStartNewSale = () => {
    setCompletedSale(null);
    setEditingSale(null);
    clearCart();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Start Editing Sale (Req 6 & 8)
  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setCompletedSale(null);

    // 1. Recover store
    if (sale.storeId && storeLocations.some((s) => s.id === sale.storeId)) {
      setSelectedStoreId(sale.storeId);
    }

    // 2. Recover client
    if (sale.clientId) {
      const foundClient = clients.find((c) => c.id === sale.clientId);
      if (foundClient) {
        setSelectedClient(foundClient);
      } else if (sale.client) {
        setSelectedClient(sale.client as Client);
      } else {
        setSelectedClient(null);
      }
    } else {
      setSelectedClient(null);
    }

    // 3. Recover products and quantities into cart
    const loadedCart: CartLine[] = sale.items.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const stockInfo = storeStocks.get(item.productId);
      return {
        productId: item.productId,
        productName: item.productName || prod?.name || 'Producto',
        sku: item.productCode || prod?.sku || '',
        barcode: prod?.barcode || null,
        saleType: item.productType || prod?.saleType || 'UNIT',
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal || Math.round(item.quantity * item.unitPrice * 100) / 100,
        availableStock: stockInfo?.quantity ?? 0,
        minimumStock: stockInfo?.minimumStock ?? (prod?.defaultMinStock ?? 0),
      };
    });
    setCart(loadedCart);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingSale(null);
    clearCart();
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP OPERATIONAL HEADER: STORE SELECTION & FAST ACTION BAR              */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">
              Registro de Ventas / POS
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Ventas en mostrador, pagos múltiples y sincronización con inventario
            </p>
          </div>
        </div>

        {/* Store Selector & Cash Session Indicator */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cash Session Status */}
          {activeCashSession && activeCashSession.status === 'OPEN' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeCashSession.cashRegister?.name || 'Caja'} · Turno abierto</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowOpenCashModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">lock_open</span>
              <span>Abrir Caja</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
              Tienda:
            </span>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              {storeLocations.map((s) => (
                <option key={s.id} value={s.id}>
                  📍 {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {onViewSalesHistory && (
            <button
              type="button"
              onClick={onViewSalesHistory}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span className="hidden sm:inline">Historial</span>
            </button>
          )}
        </div>
      </div>

      {/* No Store Warning */}
      {!selectedStore && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
          <span className="font-semibold">
            No hay una tienda activa configurada. Debe crear una tienda en Configuración &gt; Tiendas
            para poder registrar ventas.
          </span>
        </div>
      )}

      {/* Editing Mode Banner (Req 6 & 7) */}
      {editingSale && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[22px]">edit_note</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-950">
                  Modo Edición: Venta {editingSale.saleNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                  Mismo Folio
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Modifica productos, cantidades, cliente o métodos de pago. Al confirmar, se actualizará esta misma venta sin duplicar registros.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            Cancelar Edición
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN POS WORKSPACE: SEARCH + CART + CLIENT + TOTAL (Responsive)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Search Bar + Cart Items */}
        <div className="lg:col-span-8 space-y-4">
          {/* Fast Search & Barcode Input */}
          <div ref={searchContainerRef} className="relative">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSearchDropdownOpen(true);
                }}
                placeholder="Código de barras, SKU o nombre del producto... [Enter para agregar]"
                className="w-full pl-10 pr-24 py-3 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden shadow-xs transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-500">
                  ENTER ↵
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchDropdownOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Results */}
            {isSearchDropdownOpen && filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p, idx) => {
                  const stock = storeStocks.get(p.id) || {
                    quantity: 0,
                    minimumStock: Number(p.defaultMinStock || 0),
                  };
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <div
                      key={p.id}
                      ref={(el) => {
                        dropdownItemRefs.current[idx] = el;
                      }}
                      onClick={() => addProductToCart(p)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-indigo-50/80 text-indigo-950' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.saleType === 'KIT' && (
                            <span className="px-1.5 py-0.2 text-[10px] bg-purple-100 text-purple-700 font-semibold rounded">
                              Kit
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          SKU: {p.sku} {p.barcode ? `• Barcode: ${p.barcode}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        {/* Stock Badge */}
                        <div>
                          {p.saleType === 'KIT' ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-medium">
                              Stock por comp.
                            </span>
                          ) : stock.quantity < 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full text-[10px]">
                              Negativo ({stock.quantity})
                            </span>
                          ) : stock.quantity === 0 ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-full text-[10px]">
                              Sin stock (0)
                            </span>
                          ) : stock.quantity <= stock.minimumStock ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                              Bajo ({stock.quantity})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                              Stock: {stock.quantity}
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="font-mono font-black text-sm text-indigo-700">
                          {formatCurrency(Number(p.salePrice))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Table / Cards Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-indigo-600">
                  shopping_cart
                </span>
                Carrito de Ventas ({totalItemsCount} unidades)
              </span>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  Vaciar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px]">production_quantity_limits</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-700">El carrito está vacío</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Escanee un código de barras con el lector USB o busque productos por nombre o SKU
                    en el buscador superior.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-12 px-4 py-2.5 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <div className="col-span-5">Producto</div>
                  <div className="col-span-2 text-right">Precio Unit.</div>
                  <div className="col-span-3 text-center">Cantidad</div>
                  <div className="col-span-2 text-right">Importe</div>
                </div>

                {cart.map((item) => {
                  const projectedStock = item.availableStock - item.quantity;
                  const willBeNegative = projectedStock < 0;

                  return (
                    <div
                      key={item.productId}
                      className="p-3.5 sm:px-4 hover:bg-slate-50/60 transition-colors flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-0"
                    >
                      {/* Product Name & Code */}
                      <div className="col-span-5 min-w-0 pr-2">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>{item.sku}</span>
                          {item.saleType === 'KIT' ? (
                            <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              Combo / Kit
                            </span>
                          ) : (
                            <span>Stock actual: {item.availableStock}</span>
                          )}
                        </div>

                        {/* Informative Negative Stock Warning Badge (Req 8 & 10) */}
                        {item.saleType !== 'KIT' && willBeNegative && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <span className="material-symbols-outlined text-[12px] text-amber-600">
                              warning
                            </span>
                            <span>Dejará stock en {projectedStock} unidades</span>
                          </div>
                        )}
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 text-left md:text-right font-mono text-xs text-slate-700 flex md:block items-center justify-between">
                        <span className="md:hidden text-slate-400 font-sans text-[11px]">Precio:</span>
                        <span>{formatCurrency(item.unitPrice)}</span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="col-span-3 flex items-center justify-between md:justify-center gap-1">
                        <span className="md:hidden text-slate-400 font-sans text-[11px]">Cantidad:</span>
                        <div className="flex items-center border border-slate-300 rounded-xl bg-white shadow-2xs overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="Disminuir cantidad"
                          >
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartQuantity(
                                item.productId,
                                parseInt(e.target.value, 10) || 1,
                              )
                            }
                            className="w-12 h-8 text-center text-xs font-mono font-bold text-slate-900 border-x border-slate-200 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="Incrementar cantidad"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      </div>

                      {/* Line Total & Remove */}
                      <div className="col-span-2 flex items-center justify-between md:justify-end gap-3 text-right">
                        <span className="md:hidden text-slate-400 font-sans text-[11px]">Importe:</span>
                        <span className="font-mono font-black text-sm text-slate-900">
                          {formatCurrency(item.lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar producto"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Client Selection & Summary Box */}
        <div className="lg:col-span-4 space-y-4">
          {/* Client Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-indigo-600">person</span>
                Cliente
              </span>

              {selectedClient && (
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-[11px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
                >
                  ✕ Quitar
                </button>
              )}
            </div>

            {selectedClient ? (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{selectedClient.name}</span>
                  <span className="font-mono text-[11px] text-indigo-600 font-bold">
                    {selectedClient.clientNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Deuda Corriente:</span>
                    <span className="font-mono font-bold text-rose-700">
                      S/ {Number(selectedClient.dailyDebtBalance || selectedClient.currentBalance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Crédito Disp.:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {selectedClient.creditLimit > 0
                        ? formatCurrency(
                            selectedClient.availableCredit !== null && selectedClient.availableCredit !== undefined
                              ? selectedClient.availableCredit
                              : Math.max(0, selectedClient.creditLimit - (selectedClient.dailyDebtBalance || 0)),
                          )
                        : 'Sin límite'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClientSelector(true)}
                  className="w-full mt-1 py-1.5 bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  ⇄ Cambiar cliente
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">
                      account_circle
                    </span>
                    <span className="font-bold text-slate-700">Consumidor Final</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Por defecto</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClientSelector(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Seleccionar Cliente Registrado
                </button>
              </div>
            )}
          </div>

          {/* Checkout & Total Summary Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Resumen de Venta
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Items agregados:</span>
                <span className="font-bold text-slate-800">{totalItemsCount}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-800">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Descuento / Impuestos:</span>
                <span className="font-mono text-slate-800">S/ 0.00</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total a Pagar
              </span>
              <span className="text-3xl font-black font-mono text-indigo-700 block mt-0.5">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {(!activeCashSession || activeCashSession.status !== 'OPEN') && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-amber-600 text-base">warning</span>
                  <span>Caja cerrada</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  No existe una caja abierta para esta tienda. Debes abrir un turno antes de registrar ventas.
                </p>
                <button
                  type="button"
                  onClick={() => setShowOpenCashModal(true)}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Abrir Turno de Caja
                </button>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                disabled={
                  cart.length === 0 ||
                  !selectedStore ||
                  !activeCashSession ||
                  activeCashSession.status !== 'OPEN'
                }
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">payments</span>
                Cobrar / Confirmar
              </button>

              <button
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-30"
              >
                Cancelar Venta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODALS: CLIENT SELECTOR / CHECKOUT / SUCCESS / OPEN CASH               */}
      {/* ========================================================================= */}
      {showClientSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Seleccionar Cliente para la Venta
              </h3>
              <button
                type="button"
                onClick={() => setShowClientSelector(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <ClientSelector
              selectedClient={selectedClient}
              onSelectClient={(client) => {
                setSelectedClient(client);
                setShowClientSelector(false);
              }}
              clients={clients}
              mode="debt"
              placeholder="Buscar por nombre, código o teléfono..."
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClientSelector(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedStore && (
        <CheckoutModal
          store={selectedStore}
          selectedClient={selectedClient}
          cashSession={activeCashSession}
          onOpenCashSessionModal={() => setShowOpenCashModal(true)}
          items={cart.map((c) => ({
            productId: c.productId,
            productName: c.productName,
            sku: c.sku,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
            lineTotal: c.lineTotal,
          }))}
          total={grandTotal}
          initialPayments={editingSale?.payments}
          initialNotes={editingSale?.notes || undefined}
          isEditing={!!editingSale}
          onClose={() => setShowCheckoutModal(false)}
          onConfirmSale={handleConfirmSale}
          onRequestSelectClient={() => {
            setShowCheckoutModal(false);
            setShowClientSelector(true);
          }}
        />
      )}

      {/* Success Modal */}
      {completedSale && (
        <SaleSuccessModal
          sale={completedSale}
          currentUser={currentUser}
          onNewSale={handleStartNewSale}
          onEditSale={handleEditSale}
        />
      )}

      {/* Open Cash Session Modal */}
      <OpenCashModal
        isOpen={showOpenCashModal}
        onClose={() => setShowOpenCashModal(false)}
        onSuccess={() => {
          loadCashSession();
        }}
        currentUser={currentUser || null}
        stores={storeLocations}
        initialStoreId={selectedStoreId}
        onConfigureRegisters={(targetStoreId) => {
          setShowOpenCashModal(false);
          onNavigateToStoreRegisters?.(targetStoreId);
        }}
      />
    </div>
  );
};
