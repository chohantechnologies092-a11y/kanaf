import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage } from './storage';

export type ShiftType = 'Morning' | 'Evening' | 'Night';
export type ShiftStatus = 'open' | 'closed' | 'audited';

export interface CashDenominations {
  d5000: number;
  d1000: number;
  d500: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

export interface ShiftRecord {
  id: string;
  shiftType: ShiftType;
  registerId: string;
  cashierId: string;
  cashierName: string;
  openedAt: number;
  openedBy: string;
  openingFloat: number;
  openingNotes?: string;
  status: ShiftStatus;

  // Blind Cashier Closing Fields (Only entered by Cashier without seeing system totals)
  closedAt?: number;
  closedBy?: string;
  closedRole?: string;
  actualCountedCash?: number;
  denominations?: CashDenominations;
  cardSlipsCount?: number;
  cardSlipsTotal?: number;
  cashierNotes?: string;

  // System Recorded Totals (Hidden from Cashier during Shift Close; visible to Manager/Admin)
  systemCashSales?: number;
  systemCardSales?: number;
  systemOnlineSales?: number;
  systemTotalSales?: number;
  settledOrdersCount?: number;
  cashPayouts?: number;
  expectedCashInDrawer?: number; // openingFloat + systemCashSales - cashPayouts
  cashVariance?: number; // actualCountedCash - expectedCashInDrawer
  varianceType?: 'balanced' | 'shortage' | 'overage';

  // Manager Audit & Approval
  auditedBy?: string;
  auditedAt?: number;
  auditNotes?: string;
  isApproved?: boolean;
}

export const INITIAL_DENOMINATIONS: CashDenominations = {
  d5000: 0,
  d1000: 0,
  d500: 0,
  d100: 0,
  d50: 0,
  d20: 0,
  d10: 0,
  coins: 0,
};

export function calculateDenominationTotal(denoms: CashDenominations): number {
  return (
    (denoms.d5000 || 0) * 5000 +
    (denoms.d1000 || 0) * 1000 +
    (denoms.d500 || 0) * 500 +
    (denoms.d100 || 0) * 100 +
    (denoms.d50 || 0) * 50 +
    (denoms.d20 || 0) * 20 +
    (denoms.d10 || 0) * 10 +
    (denoms.coins || 0)
  );
}

const now = Date.now();
const oneDayAgo = now - 24 * 3600 * 1000;
const morningStart = new Date();
morningStart.setHours(9, 0, 0, 0);
const morningEnd = new Date();
morningEnd.setHours(16, 0, 0, 0);

export const INITIAL_SHIFTS: ShiftRecord[] = [
  {
    id: `SH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-01`,
    shiftType: 'Morning',
    registerId: 'Counter #1 (Main Dining)',
    cashierId: 'st4',
    cashierName: 'Sara Ahmed',
    openedAt: morningStart.getTime(),
    openedBy: 'Ali Khan (Manager)',
    openingFloat: 5000,
    openingNotes: 'Morning float issued: Rs. 5,000 in petty change.',
    status: 'closed',
    closedAt: morningEnd.getTime(),
    closedBy: 'Sara Ahmed (Cashier)',
    closedRole: 'Cashier',
    actualCountedCash: 48650,
    denominations: {
      d5000: 6,
      d1000: 14,
      d500: 7,
      d100: 10,
      d50: 3,
      d20: 0,
      d10: 0,
      coins: 0,
    },
    cardSlipsCount: 9,
    cardSlipsTotal: 18400,
    cashierNotes: 'Closing count completed blindly. 9 card slips stapled with settlement roll.',
    systemCashSales: 43650,
    systemCardSales: 18400,
    systemOnlineSales: 4200,
    systemTotalSales: 66250,
    settledOrdersCount: 22,
    cashPayouts: 0,
    expectedCashInDrawer: 48650, // 5000 float + 43650 cash sales
    cashVariance: 0,
    varianceType: 'balanced',
    auditedBy: 'Ali Khan (Manager)',
    auditedAt: morningEnd.getTime() + 15 * 60 * 1000,
    auditNotes: 'Reconciled 100% exact. Drawer balanced with zero shortage.',
    isApproved: true,
  },
  {
    id: `SH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-02`,
    shiftType: 'Evening',
    registerId: 'Counter #1 (Main Dining)',
    cashierId: 'st2',
    cashierName: 'Ali Khan',
    openedAt: morningEnd.getTime() + 30 * 60 * 1000,
    openedBy: 'Junaid Ahsan (Admin)',
    openingFloat: 8000,
    openingNotes: 'Dinner rush shift. Rs. 8,000 float given to drawer.',
    status: 'open',
  },
];

interface ShiftState {
  shifts: ShiftRecord[];
  activeShiftId: string | null;

  // Actions
  openShift: (params: {
    shiftType: ShiftType;
    registerId: string;
    cashierId: string;
    cashierName: string;
    openedBy: string;
    openingFloat: number;
    openingNotes?: string;
  }) => ShiftRecord;

  closeShiftBlind: (
    shiftId: string,
    params: {
      countedCash: number;
      denominations?: CashDenominations;
      cardSlipsCount?: number;
      cardSlipsTotal?: number;
      cashierNotes?: string;
      closedBy: string;
      closedRole?: string;
      systemCashSales: number;
      systemCardSales: number;
      systemOnlineSales: number;
      settledOrdersCount: number;
      cashPayouts: number;
    }
  ) => ShiftRecord | null;

  auditShift: (
    shiftId: string,
    params: {
      auditedBy: string;
      auditNotes: string;
      isApproved: boolean;
    }
  ) => void;

  reopenShift: (shiftId: string, reopenedBy: string) => void;
  setActiveShiftId: (shiftId: string | null) => void;
  getActiveShift: () => ShiftRecord | null;
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      shifts: INITIAL_SHIFTS,
      activeShiftId: INITIAL_SHIFTS.find((s) => s.status === 'open')?.id || null,

      openShift: (params) => {
        const id = `SH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(
          get().shifts.length + 1
        ).padStart(2, '0')}`;

        const newShift: ShiftRecord = {
          id,
          shiftType: params.shiftType,
          registerId: params.registerId,
          cashierId: params.cashierId,
          cashierName: params.cashierName,
          openedAt: Date.now(),
          openedBy: params.openedBy,
          openingFloat: params.openingFloat,
          openingNotes: params.openingNotes,
          status: 'open',
        };

        set((state) => ({
          shifts: [
            newShift,
            ...state.shifts.map((s) =>
              s.status === 'open' ? { ...s, status: 'closed' as const, closedAt: Date.now() } : s
            ),
          ],
          activeShiftId: newShift.id,
        }));

        return newShift;
      },

      closeShiftBlind: (shiftId, params) => {
        const state = get();
        const target = state.shifts.find((s) => s.id === shiftId);
        if (!target) return null;

        const expectedCash = target.openingFloat + params.systemCashSales - params.cashPayouts;
        const variance = params.countedCash - expectedCash;
        const varianceType: 'balanced' | 'shortage' | 'overage' =
          variance === 0 ? 'balanced' : variance > 0 ? 'overage' : 'shortage';

        const updatedShift: ShiftRecord = {
          ...target,
          status: 'closed',
          closedAt: Date.now(),
          closedBy: params.closedBy,
          closedRole: params.closedRole || 'Cashier',
          actualCountedCash: params.countedCash,
          denominations: params.denominations,
          cardSlipsCount: params.cardSlipsCount || 0,
          cardSlipsTotal: params.cardSlipsTotal || 0,
          cashierNotes: params.cashierNotes,

          // System recorded financials calculated confidentially
          systemCashSales: params.systemCashSales,
          systemCardSales: params.systemCardSales,
          systemOnlineSales: params.systemOnlineSales,
          systemTotalSales: params.systemCashSales + params.systemCardSales + params.systemOnlineSales,
          settledOrdersCount: params.settledOrdersCount,
          cashPayouts: params.cashPayouts,
          expectedCashInDrawer: expectedCash,
          cashVariance: variance,
          varianceType,
        };

        set((s) => ({
          shifts: s.shifts.map((item) => {
            if (item.id === shiftId) return updatedShift;
            if (item.status === 'open') return { ...item, status: 'closed' as const, closedAt: Date.now() };
            return item;
          }),
          activeShiftId: null,
        }));

        return updatedShift;
      },

      auditShift: (shiftId, params) => {
        set((state) => ({
          shifts: state.shifts.map((s) =>
            s.id === shiftId
              ? {
                  ...s,
                  status: 'audited',
                  auditedBy: params.auditedBy,
                  auditedAt: Date.now(),
                  auditNotes: params.auditNotes,
                  isApproved: params.isApproved,
                }
              : s
          ),
        }));
      },

      reopenShift: (shiftId, _reopenedBy) => {
        set((state) => ({
          shifts: state.shifts.map((s) =>
            s.id === shiftId
              ? {
                  ...s,
                  status: 'open',
                  closedAt: undefined,
                  actualCountedCash: undefined,
                  cashVariance: undefined,
                  varianceType: undefined,
                }
              : s
          ),
          activeShiftId: shiftId,
        }));
      },

      setActiveShiftId: (shiftId) => set({ activeShiftId: shiftId }),

      getActiveShift: () => {
        const state = get();
        if (state.activeShiftId) {
          return state.shifts.find((s) => s.id === state.activeShiftId && s.status === 'open') || null;
        }
        return null;
      },
    }),
    {
      name: 'sultan-shift-store-v1',
      storage: appStorage,
      merge: (persistedState: any, currentState) => {
        const p = persistedState as Partial<ShiftState> | undefined;
        return {
          ...currentState,
          ...p,
          shifts: p?.shifts && p.shifts.length > 0 ? p.shifts : currentState.shifts,
        };
      },
    }
  )
);
