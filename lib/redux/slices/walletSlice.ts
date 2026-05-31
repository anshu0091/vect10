import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { createTransaction } from '@/lib/api/marketplace';
import { loadWalletSnapshot } from '@/lib/wallet/loadWalletSnapshot';

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  creditId: string;
  creditName: string;
  quantity: number;
  price: number;
  totalAmount: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  txHash?: string;
}

export interface WalletState {
  balance: number;
  carbonCredits: {
    id: string;
    name: string;
    quantity: number;
    tokenId?: string;
    vintage: string;
    certificationBody: string;
    carbonReduction: number;
  }[];
  transactions: Transaction[];
  connected: boolean;
  address: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: WalletState = {
  balance: 0,
  carbonCredits: [],
  transactions: [],
  connected: false,
  address: null,
  loading: false,
  error: null,
};

export const fetchWalletData = createAsyncThunk(
  'wallet/fetchData',
  async () => loadWalletSnapshot()
);

export const purchaseCarbonCredit = createAsyncThunk(
  'wallet/purchaseCredit',
  async (data: {
    creditId: string;
    creditName: string;
    quantity: number;
    price: number;
    vintage: string;
    certificationBody: string;
    carbonReduction: number;
  }) => {
    await createTransaction({
      creditId: data.creditId,
      type: 'buy',
      quantity: data.quantity,
      price: data.price,
    });
    return loadWalletSnapshot();
  }
);

export const sellCarbonCredit = createAsyncThunk(
  'wallet/sellCredit',
  async (data: {
    creditId: string;
    creditName: string;
    quantity: number;
    price: number;
  }) => {
    await createTransaction({
      creditId: data.creditId,
      type: 'sell',
      quantity: data.quantity,
      price: data.price,
    });
    return loadWalletSnapshot();
  }
);

function applyWalletSnapshot(
  state: WalletState,
  payload: Awaited<ReturnType<typeof loadWalletSnapshot>>
) {
  state.balance = payload.balance;
  state.carbonCredits = payload.carbonCredits;
  state.transactions = payload.transactions as Transaction[];
}

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
    addCarbonCredits: (state, action: PayloadAction<WalletState['carbonCredits'][0]>) => {
      const existingIndex = state.carbonCredits.findIndex(
        (credit) => credit.id === action.payload.id
      );

      if (existingIndex !== -1) {
        state.carbonCredits[existingIndex].quantity += action.payload.quantity;
      } else {
        state.carbonCredits.push(action.payload);
      }
    },
    removeCarbonCredits: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const { id, quantity } = action.payload;
      const existingIndex = state.carbonCredits.findIndex((credit) => credit.id === id);

      if (existingIndex !== -1) {
        state.carbonCredits[existingIndex].quantity -= quantity;

        if (state.carbonCredits[existingIndex].quantity <= 0) {
          state.carbonCredits.splice(existingIndex, 1);
        }
      }
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload);
    },
    updateTransaction: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Transaction> }>
    ) => {
      const { id, updates } = action.payload;
      const index = state.transactions.findIndex((tx) => tx.id === id);

      if (index !== -1) {
        state.transactions[index] = { ...state.transactions[index], ...updates };
      }
    },
    setWalletConnection: (
      state,
      action: PayloadAction<{ connected: boolean; address: string | null }>
    ) => {
      state.connected = action.payload.connected;
      state.address = action.payload.address;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWalletData.fulfilled, (state, action) => {
        state.loading = false;
        applyWalletSnapshot(state, action.payload);
      })
      .addCase(fetchWalletData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch wallet data';
      })
      .addCase(purchaseCarbonCredit.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(purchaseCarbonCredit.fulfilled, (state, action) => {
        state.loading = false;
        applyWalletSnapshot(state, action.payload);
      })
      .addCase(purchaseCarbonCredit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to purchase carbon credit';
      })
      .addCase(sellCarbonCredit.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sellCarbonCredit.fulfilled, (state, action) => {
        state.loading = false;
        applyWalletSnapshot(state, action.payload);
      })
      .addCase(sellCarbonCredit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to sell carbon credit';
      });
  },
});

export const {
  setBalance,
  addCarbonCredits,
  removeCarbonCredits,
  addTransaction,
  updateTransaction,
  setWalletConnection,
  setLoading,
  setError,
} = walletSlice.actions;

export default walletSlice.reducer;
