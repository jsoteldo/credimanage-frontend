import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/utils/loanCalculations.ts',
        'src/components/ClientSelector.tsx',
        'src/components/ClientsTable.tsx',
        'src/components/DebtView.tsx',
        'src/components/BankView.tsx',
        'src/components/AddDebtModal.tsx',
        'src/components/GrantLoanModal.tsx',
      ],
    },
  },
});
