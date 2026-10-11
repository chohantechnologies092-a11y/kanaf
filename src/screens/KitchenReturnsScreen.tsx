import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import KitchenOpsNav from '../components/KitchenOpsNav';
import { useKitchenStore } from '../store/kitchenStore';
import { useAuthStore } from '../store/authStore';
import { formatQty, money } from '../utils/kitchenMath';

const BRAND = {
  burgundy: '#52171B',
  burgundyDark: '#3A0F12',
  gold: '#D5A943',
  goldDark: '#9E7A23',
  goldLight: '#F5E6BE',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
  success: '#2E7D32',
  danger: '#C62828',
  warn: '#E65100',
  info: '#0277BD',
  cream: '#FDFBF7',
};

export default function KitchenReturnsScreen({ backRoute = '/admin/dashboard' }: { backRoute?: string }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const {
    kitchenSessions,
    kitchenCash,
    kitchenSettings,
    approveSession,
    rejectClosing,
  } = useKitchenStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');

  const adminName = user?.name || 'Admin / GM';

  // Pending sessions awaiting GM approval
  const pendingSessions = useMemo(() => {
    return kitchenSessions
      .filter((s) => s.status === 'pending_approval')
      .sort((a, b) => (b.closingSubmittedAt || 0) - (a.closingSubmittedAt || 0));
  }, [kitchenSessions]);

  // Closed historical sessions
  const closedSessions = useMemo(() => {
    return kitchenSessions
      .filter((s) => s.status === 'closed')
      .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));
  }, [kitchenSessions]);

  // Current session being viewed
  const activeReviewSession = useMemo(() => {
    if (selectedSessionId) {
      return kitchenSessions.find((s) => s.id === selectedSessionId) || null;
    }
    if (activeTab === 'pending' && pendingSessions.length > 0) {
      return pendingSessions[0];
    }
    if (activeTab === 'history' && closedSessions.length > 0) {
      return closedSessions[0];
    }
    return null;
  }, [selectedSessionId, activeTab, pendingSessions, closedSessions, kitchenSessions]);

  // Cash entries for review session
  const reviewCashEntries = useMemo(() => {
    if (!activeReviewSession) return [];
    return kitchenCash.filter((c) => c.sessionId === activeReviewSession.id);
  }, [kitchenCash, activeReviewSession]);

  const totalMarketSpent = useMemo(() => {
    return reviewCashEntries.reduce((s, c) => s + c.amount, 0);
  }, [reviewCashEntries]);

  const expectedCashReturn = useMemo(() => {
    if (!activeReviewSession) return 0;
    return activeReviewSession.cashHandedOver - totalMarketSpent;
  }, [activeReviewSession, totalMarketSpent]);

  const actualCashReturned = activeReviewSession?.cashReturned ?? 0;
  const cashDiscrepancy = actualCashReturned - expectedCashReturn;

  // Stock Variance Analysis
  const varianceAnalysis = useMemo(() => {
    if (!activeReviewSession) return { items: [], totalVarianceVal: 0, highVarianceCount: 0 };

    let totalVarianceVal = 0;
    let highVarianceCount = 0;

    const items = activeReviewSession.lines.map((line) => {
      const exp = line.expectedAtClose ?? (line.issued + line.topUp + line.localPurchased);
      const ret = line.returned ?? 0;
      const diff = ret - exp; // negative = shrinkage/loss
      const diffVal = diff * (line.costPerUnit || 0);
      totalVarianceVal += diffVal;

      const tolerance = (exp * (kitchenSettings.varianceTolerancePct || 3)) / 100;
      const isAbnormal = Math.abs(diff) > tolerance && Math.abs(diffVal) > 100;
      if (isAbnormal) highVarianceCount++;

      return {
        ...line,
        expected: exp,
        returnedCount: ret,
        diff,
        diffVal,
        isAbnormal,
      };
    });

    return { items, totalVarianceVal, highVarianceCount };
  }, [activeReviewSession, kitchenSettings]);

  // Handlers
  const handleApprove = () => {
    if (!activeReviewSession) return;
    const res = approveSession(activeReviewSession.id, adminName, approvalNote.trim() || undefined);
    if (!res.ok) {
      Alert.alert('Approval Error', res.error);
      return;
    }
    setApprovalModalOpen(false);
    Alert.alert(
      'Session Approved & Restocked',
      `Kitchen shift for ${activeReviewSession.dayLabel} closed successfully! Unused ingredients have been restored to Store Inventory.`
    );
  };

  const handleReject = () => {
    if (!activeReviewSession) return;
    if (!rejectionNote.trim()) {
      Alert.alert('Validation', 'Please provide a reason note for requesting recount.');
      return;
    }
    const res = rejectClosing(activeReviewSession.id, adminName, rejectionNote.trim());
    if (!res.ok) {
      Alert.alert('Error', res.error);
      return;
    }
    setRejectModalOpen(false);
    Alert.alert('Returned to Chef', 'Session reopened so Head Chef can recount and fix discrepancies.');
  };

  return (
    <View style={styles.container}>
      <KitchenOpsNav backRoute={backRoute} />

      <View style={styles.mainLayout}>
        {/* Left Column: Sessions List */}
        <View style={[styles.leftPane, isMobile && styles.leftPaneMobile]}>
          <View style={styles.paneTabs}>
            <TouchableOpacity
              style={[styles.paneTab, activeTab === 'pending' && styles.paneTabActive]}
              onPress={() => {
                setActiveTab('pending');
                setSelectedSessionId(null);
              }}
            >
              <Text style={[styles.paneTabText, activeTab === 'pending' && styles.paneTabTextActive]}>
                Awaiting Approval ({pendingSessions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paneTab, activeTab === 'history' && styles.paneTabActive]}
              onPress={() => {
                setActiveTab('history');
                setSelectedSessionId(null);
              }}
            >
              <Text style={[styles.paneTabText, activeTab === 'history' && styles.paneTabTextActive]}>
                Closed Archive ({closedSessions.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sessionList} showsVerticalScrollIndicator={false}>
            {(activeTab === 'pending' ? pendingSessions : closedSessions).map((s) => {
              const isSel = activeReviewSession?.id === s.id;

              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sessionCard, isSel && styles.sessionCardActive]}
                  onPress={() => setSelectedSessionId(s.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.sessionDay, isSel && { color: BRAND.burgundy }]}>{s.dayLabel}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        s.status === 'pending_approval' ? styles.statusPillPending : styles.statusPillClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          s.status === 'pending_approval' ? { color: BRAND.warn } : { color: BRAND.success },
                        ]}
                      >
                        {s.status === 'pending_approval' ? 'Pending GM' : 'Closed & Restocked'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sessionChef}>Chef: {s.headChef}</Text>
                  <View style={styles.sessionMetaRow}>
                    <Text style={styles.sessionMeta}>Lines: {s.lines.length} items</Text>
                    <Text style={styles.sessionDot}>•</Text>
                    <Text style={styles.sessionMeta}>Hand Cash: {money(s.cashHandedOver)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {(activeTab === 'pending' ? pendingSessions : closedSessions).length === 0 && (
              <View style={styles.emptySessions}>
                <Ionicons name="file-tray-outline" size={36} color={BRAND.muted} />
                <Text style={styles.emptySessionsText}>
                  {activeTab === 'pending' ? 'No sessions awaiting approval' : 'No closed sessions yet'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Right Column: Detailed Review & Reconciliation */}
        <View style={styles.rightPane}>
          {activeReviewSession ? (
            <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
              {/* Header Card */}
              <View style={styles.reviewHeaderCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.reviewTitle}>EOD Verification: {activeReviewSession.dayLabel}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        activeReviewSession.status === 'pending_approval'
                          ? styles.statusPillPending
                          : styles.statusPillClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          activeReviewSession.status === 'pending_approval'
                            ? { color: BRAND.warn }
                            : { color: BRAND.success },
                        ]}
                      >
                        {activeReviewSession.status === 'pending_approval' ? 'Pending GM Approval' : 'Closed & Restocked'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reviewSub}>
                    Submitted by Head Chef {activeReviewSession.headChef} •{' '}
                    {activeReviewSession.closingSubmittedAt
                      ? new Date(activeReviewSession.closingSubmittedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recently'}
                  </Text>
                  {activeReviewSession.closingNotes && (
                    <Text style={styles.closingChefNote}>
                      Chef Note: &ldquo;{activeReviewSession.closingNotes}&rdquo;
                    </Text>
                  )}
                </View>

                {activeReviewSession.status === 'pending_approval' && (
                  <View style={styles.reviewActionBtns}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => setRejectModalOpen(true)}
                    >
                      <Ionicons name="refresh-outline" size={16} color={BRAND.danger} />
                      <Text style={styles.rejectBtnText}>Request Recount</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => setApprovalModalOpen(true)}
                    >
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.approveBtnText}>Approve & Restock Store</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* CASH RECONCILIATION CARD */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>1. Hand Cash Audit & Reconciliation</Text>
                <Text style={styles.sectionCardSub}>
                  Initial cash handed over minus petty market purchases vs physical cash handed back
                </Text>

                <View style={styles.cashReconRow}>
                  <View style={styles.cashBox}>
                    <Text style={styles.cashBoxLabel}>Initial Hand Cash</Text>
                    <Text style={styles.cashBoxVal}>{money(activeReviewSession.cashHandedOver)}</Text>
                    <Text style={styles.cashBoxSub}>Issued at morning handover</Text>
                  </View>

                  <Text style={styles.mathSym}>−</Text>

                  <View style={styles.cashBox}>
                    <Text style={styles.cashBoxLabel}>Local Market Buys</Text>
                    <Text style={[styles.cashBoxVal, { color: BRAND.danger }]}>{money(totalMarketSpent)}</Text>
                    <Text style={styles.cashBoxSub}>{reviewCashEntries.length} receipts attached</Text>
                  </View>

                  <Text style={styles.mathSym}>=</Text>

                  <View style={styles.cashBox}>
                    <Text style={styles.cashBoxLabel}>Expected Cash Return</Text>
                    <Text style={styles.cashBoxVal}>{money(expectedCashReturn)}</Text>
                    <Text style={styles.cashBoxSub}>Should be returned in cash</Text>
                  </View>

                  <View style={styles.vsDivider} />

                  <View style={[styles.cashBox, { backgroundColor: BRAND.cream, borderColor: BRAND.gold }]}>
                    <Text style={styles.cashBoxLabel}>Actual Cash Returned</Text>
                    <Text style={[styles.cashBoxVal, { color: BRAND.burgundy }]}>{money(actualCashReturned)}</Text>
                    <Text
                      style={[
                        styles.cashBoxSub,
                        {
                          color:
                            cashDiscrepancy === 0
                              ? BRAND.success
                              : cashDiscrepancy > 0
                              ? BRAND.info
                              : BRAND.danger,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {cashDiscrepancy === 0
                        ? 'Exact Match (Rs. 0)'
                        : cashDiscrepancy > 0
                        ? `Surplus +${money(cashDiscrepancy)}`
                        : `Shortage -${money(Math.abs(cashDiscrepancy))}`}
                    </Text>
                  </View>
                </View>

                {/* Market Purchase Receipts List */}
                {reviewCashEntries.length > 0 && (
                  <View style={styles.receiptsWrap}>
                    <Text style={styles.receiptsTitle}>Market Expense Receipts Log:</Text>
                    {reviewCashEntries.map((c) => (
                      <View key={c.id} style={styles.receiptItem}>
                        <Ionicons name="receipt-outline" size={14} color={BRAND.burgundy} />
                        <Text style={styles.receiptNote}>{c.note}</Text>
                        <Text style={styles.receiptAmount}>-{money(c.amount)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* STOCK VARIANCE & RESTOCK TABLE */}
              <View style={styles.sectionCard}>
                <View style={styles.stockHeaderRow}>
                  <View>
                    <Text style={styles.sectionCardTitle}>2. Physical Stock Variance & Restock Audit</Text>
                    <Text style={styles.sectionCardSub}>
                      Comparison between theoretical expected on-hand and physical items returned to store
                    </Text>
                  </View>

                  <View style={styles.varianceSummaryBadge}>
                    <Text style={styles.varianceBadgeLabel}>Net Variance Impact:</Text>
                    <Text
                      style={[
                        styles.varianceBadgeVal,
                        { color: varianceAnalysis.totalVarianceVal < 0 ? BRAND.danger : BRAND.success },
                      ]}
                    >
                      {varianceAnalysis.totalVarianceVal < 0
                        ? `- ${money(Math.abs(varianceAnalysis.totalVarianceVal))} (Loss)`
                        : `+ ${money(varianceAnalysis.totalVarianceVal)} (Gain)`}
                    </Text>
                  </View>
                </View>

                {varianceAnalysis.highVarianceCount > 0 && (
                  <View style={styles.alertBanner}>
                    <Ionicons name="warning" size={18} color={BRAND.warn} />
                    <Text style={styles.alertBannerText}>
                      Attention: {varianceAnalysis.highVarianceCount} item(s) have abnormal shrinkage exceeding tolerance. Verify before approving restock.
                    </Text>
                  </View>
                )}

                <View style={styles.varTable}>
                  <View style={styles.thRow}>
                    <Text style={[styles.th, { flex: 3 }]}>Item & Unit</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Total In</Text>
                    <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Expected Left</Text>
                    <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Chef Counted</Text>
                    <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Variance Qty</Text>
                    <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Variance Value</Text>
                    <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Restock to Store</Text>
                  </View>

                  {varianceAnalysis.items.map((line) => {
                    const isLoss = line.diff < 0;
                    const isGain = line.diff > 0;

                    return (
                      <View key={line.itemId} style={[styles.trRow, line.isAbnormal && styles.trRowAbnormal]}>
                        <View style={{ flex: 3 }}>
                          <Text style={styles.trItemName}>{line.itemName}</Text>
                          <Text style={styles.trSub}>{line.category} • Cost {money(line.costPerUnit)}/{line.unit}</Text>
                        </View>

                        <Text style={[styles.tr, { flex: 1.5, textAlign: 'right' }]}>
                          {formatQty(line.issued + line.topUp + line.localPurchased, line.unit)}
                        </Text>

                        <Text style={[styles.tr, { flex: 1.8, textAlign: 'right', fontWeight: '600' }]}>
                          {formatQty(line.expected, line.unit)}
                        </Text>

                        <Text style={[styles.tr, { flex: 1.8, textAlign: 'right', fontWeight: '800', color: BRAND.ink }]}>
                          {formatQty(line.returnedCount, line.unit)}
                        </Text>

                        <Text
                          style={[
                            styles.tr,
                            {
                              flex: 1.8,
                              textAlign: 'right',
                              fontWeight: '700',
                              color: isLoss ? BRAND.danger : isGain ? BRAND.success : BRAND.muted,
                            },
                          ]}
                        >
                          {isLoss
                            ? `-${formatQty(Math.abs(line.diff), line.unit)}`
                            : isGain
                            ? `+${formatQty(line.diff, line.unit)}`
                            : '0'}
                        </Text>

                        <Text
                          style={[
                            styles.tr,
                            {
                              flex: 2,
                              textAlign: 'right',
                              fontWeight: '700',
                              color: isLoss ? BRAND.danger : isGain ? BRAND.success : BRAND.muted,
                            },
                          ]}
                        >
                          {line.diffVal !== 0 ? (line.diffVal < 0 ? `-${money(Math.abs(line.diffVal))}` : `+${money(line.diffVal)}`) : 'Rs. 0'}
                        </Text>

                        <View style={{ flex: 1.8, alignItems: 'flex-end' }}>
                          <View style={styles.restockPill}>
                            <Ionicons name="arrow-undo" size={11} color={BRAND.success} />
                            <Text style={styles.restockPillText}>+{formatQty(line.returnedCount, line.unit)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Closed Session Summary Details (if already closed) */}
              {activeReviewSession.status === 'closed' && activeReviewSession.summary && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Final Shift Performance Summary</Text>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Dishes Cooked & Sold</Text>
                      <Text style={styles.summaryVal}>{activeReviewSession.summary.dishesSold} plates</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Theoretical Food Cost</Text>
                      <Text style={styles.summaryVal}>{money(activeReviewSession.summary.theoreticalCost)}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Stock Used Value</Text>
                      <Text style={styles.summaryVal}>{money(activeReviewSession.summary.usedValue)}</Text>
                    </View>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryLabel}>Approved By</Text>
                      <Text style={styles.summaryVal}>{activeReviewSession.approvedBy || 'Admin'}</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={54} color={BRAND.border} />
              <Text style={styles.emptyStateTitle}>Select a kitchen session to review</Text>
              <Text style={styles.emptyStateSub}>
                Reconcile physical stock counts, verify petty hand cash, and approve automatic restock.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* MODAL: APPROVE & RESTOCK CONFIRMATION */}
      <Modal visible={approvalModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Confirm Closing & Restock Store</Text>
                <Text style={styles.modalSubtitle}>
                  Authorizing {activeReviewSession?.dayLabel} kitchen handover completion
                </Text>
              </View>
              <TouchableOpacity onPress={() => setApprovalModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.confirmBox}>
                <Ionicons name="information-circle" size={22} color={BRAND.info} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmBoxTitle}>Automated Store Restocking</Text>
                  <Text style={styles.confirmBoxSub}>
                    Approving will automatically restore all {activeReviewSession?.lines.length} returned ingredient quantities back into Store Inventory, and finalize the cash ledger.
                  </Text>
                </View>
              </View>

              <View style={styles.formCol}>
                <Text style={styles.inputLabel}>GM / Admin Approval Note (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 70 }]}
                  value={approvalNote}
                  onChangeText={setApprovalNote}
                  multiline
                  placeholder="e.g. Verified physical counts in cold storage. Tolerances verified and approved."
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setApprovalModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmApproveBtn} onPress={handleApprove}>
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={styles.confirmApproveBtnText}>Authorize & Restock Store</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: REJECT & REQUEST RECOUNT */}
      <Modal visible={rejectModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: BRAND.danger }]}>Request Physical Recount</Text>
                <Text style={styles.modalSubtitle}>Return count back to Head Chef for corrections</Text>
              </View>
              <TouchableOpacity onPress={() => setRejectModalOpen(false)}>
                <Ionicons name="close" size={24} color={BRAND.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Reason / Discrepancy Note for Chef *</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={rejectionNote}
                onChangeText={setRejectionNote}
                multiline
                placeholder="e.g. Chicken breast count is short by 4 kg; please recheck the second freezer tray..."
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRejectBtn} onPress={handleReject}>
                <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
                <Text style={styles.confirmRejectBtnText}>Send Back for Recount</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    width: 360,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: BRAND.border,
    display: 'flex',
    flexDirection: 'column',
  },
  leftPaneMobile: {
    width: '100%',
  },
  paneTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  paneTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
  },
  paneTabActive: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 3,
    borderBottomColor: BRAND.burgundy,
  },
  paneTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  paneTabTextActive: {
    color: BRAND.burgundy,
  },
  sessionList: {
    flex: 1,
    padding: 12,
  },
  sessionCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  sessionCardActive: {
    borderColor: BRAND.gold,
    backgroundColor: BRAND.cream,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.burgundy,
  },
  sessionDay: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.ink,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillPending: {
    backgroundColor: '#FFF3E0',
  },
  statusPillClosed: {
    backgroundColor: '#E8F5E9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sessionChef: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 4,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sessionMeta: {
    fontSize: 11,
    color: BRAND.ink,
    fontWeight: '600',
  },
  sessionDot: {
    fontSize: 11,
    color: BRAND.muted,
  },
  emptySessions: {
    padding: 32,
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: 13,
    color: BRAND.muted,
    marginTop: 8,
  },
  rightPane: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  reviewScroll: {
    flex: 1,
    padding: 16,
  },
  reviewHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.burgundy,
  },
  reviewSub: {
    fontSize: 12,
    color: BRAND.muted,
    marginTop: 3,
  },
  closingChefNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: BRAND.ink,
    marginTop: 6,
    backgroundColor: '#FAF7F0',
    padding: 6,
    borderRadius: 6,
  },
  reviewActionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.danger,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 16,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  sectionCardSub: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  cashReconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  cashBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cashBoxLabel: {
    fontSize: 10,
    color: BRAND.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cashBoxVal: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 4,
  },
  cashBoxSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 4,
  },
  mathSym: {
    fontSize: 20,
    fontWeight: '900',
    color: BRAND.muted,
  },
  vsDivider: {
    width: 1,
    height: 40,
    backgroundColor: BRAND.border,
  },
  receiptsWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  receiptsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
    marginBottom: 6,
  },
  receiptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  receiptNote: {
    flex: 1,
    fontSize: 12,
    color: BRAND.ink,
  },
  receiptAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.danger,
  },
  stockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  varianceSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F0',
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  varianceBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.muted,
  },
  varianceBadgeVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: BRAND.warn,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  alertBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.warn,
    flex: 1,
  },
  varTable: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.muted,
    textTransform: 'uppercase',
  },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE1',
  },
  trRowAbnormal: {
    backgroundColor: '#FFF3E055',
  },
  tr: {
    fontSize: 12,
    color: BRAND.ink,
  },
  trItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.ink,
  },
  trSub: {
    fontSize: 10,
    color: BRAND.muted,
    marginTop: 1,
  },
  restockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  restockPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.success,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.burgundy,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCol: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FAF7F0',
    padding: 10,
    borderRadius: 8,
  },
  summaryLabel: {
    fontSize: 10,
    color: BRAND.muted,
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.ink,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.ink,
    marginTop: 14,
  },
  emptyStateSub: {
    fontSize: 12,
    color: BRAND.muted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 340,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FAF7F0',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  modalSubtitle: {
    fontSize: 11,
    color: BRAND.muted,
    marginTop: 2,
  },
  modalBody: {
    padding: 18,
  },
  confirmBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E1F5FE',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  confirmBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#01579B',
  },
  confirmBoxSub: {
    fontSize: 11,
    color: BRAND.ink,
    marginTop: 3,
  },
  formCol: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FDFBF7',
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: BRAND.ink,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    backgroundColor: '#FAF7F0',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.muted,
  },
  confirmApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.burgundy,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  confirmApproveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  confirmRejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
