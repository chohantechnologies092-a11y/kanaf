import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, ItemFeedback } from '../store/restaurantStore';
import SultanLogo from '../components/SultanLogo';

const POSITIVE_TAGS = [
  'Delicious 😋',
  'Authentic Taste 👑',
  'Served Hot 🔥',
  'Juicy & Fresh 🥩',
  'Generous Portion 🍲',
  'Quick Service ⚡',
];

const CONSTRUCTIVE_TAGS = [
  'Too Spicy 🌶️',
  'Too Salty 🧂',
  'Too Oily 🍳',
  'Served Lukewarm ❄️',
  'Small Portion 📉',
  'Slow ⏱️',
];

export default function CustomerFeedbackScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const invoices = useRestaurantStore((state) => state.invoices);
  const addFeedback = useRestaurantStore((state) => state.addFeedback);

  // Search/Lookup state if no invoiceId or not found
  const [lookupInput, setLookupInput] = useState(params.invoiceId || '');

  // Target Invoice
  const selectedInvoice = useMemo(() => {
    const raw = lookupInput.trim() || params.invoiceId || '';
    if (!raw) {
      return invoices.length > 0 ? invoices[0] : null;
    }
    const cleanId = raw.toUpperCase().replace(/^#/, '');
    return (
      invoices.find(
        (inv) => inv.id.toUpperCase() === cleanId || inv.id.toUpperCase() === `INV-${cleanId}`
      ) || null
    );
  }, [lookupInput, params.invoiceId, invoices]);

  // Overall Experience Ratings
  const [overallRating, setOverallRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [ambianceRating, setAmbianceRating] = useState<number>(5);
  const [generalComments, setGeneralComments] = useState<string>('');

  // Guest Details
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');

  // Item-wise feedback storage
  const [itemReviews, setItemReviews] = useState<{
    [itemId: string]: { rating: number; tags: string[]; comment: string };
  }>({});

  const getItemReview = (key: string) => {
    return (
      itemReviews[key] || {
        rating: 5,
        tags: ['Delicious 😋'],
        comment: '',
      }
    );
  };

  // Submission Status
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [voucherCode, setVoucherCode] = useState<string>('SULTAN-VIP10');

  const updateItemRating = (key: string, rating: number) => {
    const current = getItemReview(key);
    setItemReviews((prev) => ({
      ...prev,
      [key]: {
        ...current,
        rating,
      },
    }));
  };

  const toggleItemTag = (key: string, tag: string) => {
    const current = getItemReview(key);
    const exists = current.tags.includes(tag);
    const newTags = exists
      ? current.tags.filter((t) => t !== tag)
      : [...current.tags, tag];
    setItemReviews((prev) => ({
      ...prev,
      [key]: {
        ...current,
        tags: newTags,
      },
    }));
  };

  const updateItemComment = (key: string, comment: string) => {
    const current = getItemReview(key);
    setItemReviews((prev) => ({
      ...prev,
      [key]: {
        ...current,
        comment,
      },
    }));
  };

  const handleSubmit = () => {
    if (!selectedInvoice) {
      const msg = 'Please locate an invoice to provide feedback.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
      return;
    }

    const finalName = guestName.trim() || selectedInvoice.customer?.name || 'Valued Guest';
    const finalPhone = guestPhone.trim() || selectedInvoice.customer?.phone || '';

    if (!finalPhone.trim()) {
      const msg = 'Please enter your mobile number so we can credit your 50 Sultan Loyalty Points!';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Phone Required', msg);
      return;
    }

    const itemsFeedbackList: ItemFeedback[] = (selectedInvoice.items || []).map((it, idx) => {
      const key = `${it.id || idx}-${it.name}`;
      const rev = getItemReview(key);
      return {
        itemId: it.id || `item-${idx}`,
        itemName: it.name,
        rating: rev.rating,
        tags: rev.tags,
        comment: rev.comment.trim() || undefined,
      };
    });

    // Save to store
    addFeedback({
      invoiceId: selectedInvoice.id,
      customerId: selectedInvoice.customer?.id,
      customerName: finalName,
      customerPhone: finalPhone,
      overallRating,
      serviceRating,
      ambianceRating,
      generalComments: generalComments.trim() || undefined,
      items: itemsFeedbackList,
    });

    const generatedVoucher = `SULTAN-${Math.floor(1000 + Math.random() * 9000)}`;
    setVoucherCode(generatedVoucher);
    setIsSubmitted(true);
  };

  const handleShareVoucher = () => {
    const text = `🎉 Sultan Restaurant 10% Royal Reward Voucher: ${voucherCode}\nThank you for dining with us! Present this code for 10% off your next meal.`;
    if (Platform.OS === 'web') {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      Linking.openURL(url);
    } else {
      Share.share({ message: text, title: 'Sultan Voucher' });
    }
  };

  // Render Star Picker
  const renderStarRating = (
    value: number,
    onChange: (rating: number) => void,
    size = 28
  ) => {
    return (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            activeOpacity={0.7}
            style={styles.starTouch}
          >
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={size}
              color={star <= value ? '#D5A943' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.starLabel}>
          {value === 5
            ? 'Exceptional 👑'
            : value === 4
            ? 'Very Good 👍'
            : value === 3
            ? 'Average 😐'
            : value === 2
            ? 'Needs Improvement 👎'
            : 'Unsatisfactory ⚠️'}
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Guest Dish & Taste Review',
          headerShown: false,
        }}
      />

      <View style={styles.screenShell}>
        {/* Top Luxury Sultan Header */}
        <View style={styles.topBanner}>
          <SultanLogo size="md" variant="bare" width={70} height={64} style={{ alignSelf: 'center' }} />
          <Text style={styles.bannerTitle}>SULTAN RESTAURANT</Text>
          <Text style={styles.bannerSubtitle}>ROYAL DINING EXPERIENCE & TASTE REVIEW</Text>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]}
          showsVerticalScrollIndicator={false}
        >
          {isSubmitted ? (
            /* Celebration & Reward Voucher Card */
            <View style={styles.successCard}>
              <View style={styles.successIconBubble}>
                <Ionicons name="checkmark-done-circle" size={64} color="#27AE60" />
              </View>

              <Text style={styles.successTitle}>Shukriya! Thank You</Text>
              <Text style={styles.successDesc}>
                Your item-wise feedback has been sent directly to our Executive Chef & Management team.
              </Text>

              {/* Loyalty Points Credited Badge */}
              <View style={styles.loyaltyRewardBadge}>
                <Ionicons name="sparkles" size={20} color="#D5A943" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.loyaltyRewardTitle}>+50 Sultan Loyalty Points Awarded!</Text>
                  <Text style={styles.loyaltyRewardSub}>Credited to phone: {guestPhone}</Text>
                </View>
              </View>

              {/* Royal Discount Voucher Box */}
              <View style={styles.voucherBox}>
                <Text style={styles.voucherPre}>YOUR EXCLUSIVE 10% OFF VOUCHER</Text>
                <Text style={styles.voucherCodeText}>{voucherCode}</Text>
                <Text style={styles.voucherTerms}>
                  Valid on your next dine-in or takeaway order. Show this code to your waiter or cashier.
                </Text>
              </View>

              <View style={styles.voucherActionsRow}>
                <TouchableOpacity
                  style={styles.shareVoucherBtn}
                  onPress={handleShareVoucher}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.shareVoucherBtnText}>Save / Share Voucher</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backHomeBtn}
                  onPress={() => router.replace('/')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="home-outline" size={18} color="#4A121A" style={{ marginRight: 8 }} />
                  <Text style={styles.backHomeBtnText}>Back to Home</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Feedback Form */
            <View style={styles.formContainer}>
              {/* Rewards Incentive Callout */}
              <View style={styles.incentiveCallout}>
                <Ionicons name="gift" size={24} color="#D5A943" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.incentiveTitle}>Rate Every Dish & Win Rewards!</Text>
                  <Text style={styles.incentiveText}>
                    Earn <Text style={{ fontWeight: 'bold', color: '#160406' }}>+50 Sultan Points</Text> and unlock an exclusive <Text style={{ fontWeight: 'bold', color: '#160406' }}>10% discount voucher</Text> for your next royal feast.
                  </Text>
                </View>
              </View>

              {/* Invoice Lookup Bar */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>1. Bill & Table Verification</Text>
                <View style={styles.lookupRow}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="receipt-outline" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.lookupInput}
                      placeholder="e.g. INV-1001 or 1001"
                      placeholderTextColor="#9CA3AF"
                      value={lookupInput}
                      onChangeText={setLookupInput}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {selectedInvoice ? (
                  <View style={styles.invoiceSummaryBox}>
                    <View style={styles.invBadgeRow}>
                      <View style={styles.invIdPill}>
                        <Text style={styles.invIdText}>Bill #{selectedInvoice.id}</Text>
                      </View>
                      <View style={styles.invTypePill}>
                        <Text style={styles.invTypeText}>
                          {selectedInvoice.orderType.toUpperCase()}
                          {selectedInvoice.tableName ? ` • ${selectedInvoice.tableName}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.invDateText}>
                        {new Date(selectedInvoice.timeSettled || selectedInvoice.timePlaced).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.invServerText}>
                      Server: {selectedInvoice.orderTakenBy || selectedInvoice.server || 'Staff'} • Total: Rs. {(selectedInvoice.total || 0).toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noInvoiceWarning}>
                    <Ionicons name="alert-circle-outline" size={20} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={styles.noInvoiceText}>
                      No bill found with ID #{lookupInput}. Please check the receipt slip.
                    </Text>
                  </View>
                )}
              </View>

              {/* Item-By-Item Dish Review Section */}
              {selectedInvoice && selectedInvoice.items && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="restaurant" size={20} color="#D5A943" style={{ marginRight: 8 }} />
                    <Text style={styles.sectionHeader}>2. Rate Each Dish (Item-Wise)</Text>
                  </View>
                  <Text style={styles.sectionSubhint}>
                    Tell our kitchen how each individual item tasted today.
                  </Text>

                  {selectedInvoice.items.map((it, idx) => {
                    const key = `${it.id || idx}-${it.name}`;
                    const rev = getItemReview(key);

                    return (
                      <View key={key} style={styles.dishReviewCard}>
                        {/* Dish Name & Quantity */}
                        <View style={styles.dishCardHeader}>
                          <View style={styles.dishQtyBadge}>
                            <Text style={styles.dishQtyText}>{it.qty}x</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dishNameText}>{it.name}</Text>
                            <Text style={styles.dishPriceText}>
                              Rs. {(it.price * it.qty).toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        {/* 1-5 Star Dish Rating */}
                        <View style={styles.dishRatingRow}>
                          <Text style={styles.dishRatingLabel}>Taste & Quality:</Text>
                          {renderStarRating(
                            rev.rating,
                            (newRating) => updateItemRating(key, newRating),
                            24
                          )}
                        </View>

                        {/* Quick Taste Tags */}
                        <Text style={styles.tagsGroupLabel}>Quick Feedback Tags:</Text>
                        <View style={styles.tagsContainer}>
                          {POSITIVE_TAGS.map((tag) => {
                            const isSelected = rev.tags.includes(tag);
                            return (
                              <TouchableOpacity
                                key={tag}
                                style={[styles.tagPill, isSelected && styles.tagPillActive]}
                                onPress={() => toggleItemTag(key, tag)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[styles.tagPillText, isSelected && styles.tagPillTextActive]}
                                >
                                  {tag}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          {CONSTRUCTIVE_TAGS.map((tag) => {
                            const isSelected = rev.tags.includes(tag);
                            return (
                              <TouchableOpacity
                                key={tag}
                                style={[
                                  styles.tagPill,
                                  styles.tagPillConstructive,
                                  isSelected && styles.tagPillConstructiveActive,
                                ]}
                                onPress={() => toggleItemTag(key, tag)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.tagPillText,
                                    isSelected && styles.tagPillTextConstructiveActive,
                                  ]}
                                >
                                  {tag}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Optional Dish Note */}
                        <TextInput
                          style={styles.dishCommentInput}
                          placeholder={`Compliment or note for ${it.name} (optional)...`}
                          placeholderTextColor="#9CA3AF"
                          value={rev.comment}
                          onChangeText={(txt) => updateItemComment(key, txt)}
                        />
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Overall Experience & Hospitality */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="sparkles" size={20} color="#D5A943" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionHeader}>3. Overall Dining & Service</Text>
                </View>

                {/* Overall Rating */}
                <View style={styles.overallRatingRow}>
                  <Text style={styles.ratingRowTitle}>Overall Experience:</Text>
                  {renderStarRating(overallRating, setOverallRating, 28)}
                </View>

                {/* Service Rating */}
                <View style={styles.overallRatingRow}>
                  <Text style={styles.ratingRowTitle}>Staff Courtesy & Speed:</Text>
                  {renderStarRating(serviceRating, setServiceRating, 24)}
                </View>

                {/* Ambiance Rating */}
                <View style={styles.overallRatingRow}>
                  <Text style={styles.ratingRowTitle}>Ambiance & Cleanliness:</Text>
                  {renderStarRating(ambianceRating, setAmbianceRating, 24)}
                </View>

                {/* General Comments */}
                <Text style={styles.inputFieldLabel}>Suggestions or Special Memories:</Text>
                <TextInput
                  style={styles.generalTextArea}
                  placeholder="Share anything you loved or want us to improve for next time..."
                  placeholderTextColor="#9CA3AF"
                  value={generalComments}
                  onChangeText={setGeneralComments}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Guest Rewards Registration */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="person-circle" size={22} color="#D5A943" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionHeader}>4. Guest Details & Points Reward</Text>
                </View>
                <Text style={styles.sectionSubhint}>
                  Enter your mobile number to instantly claim 50 Sultan Loyalty Points & 10% voucher.
                </Text>

                <View style={styles.guestFieldsRow}>
                  <View style={styles.guestFieldCol}>
                    <Text style={styles.inputFieldLabel}>Your Name</Text>
                    <TextInput
                      style={styles.guestInput}
                      placeholder="e.g. Zubair Tariq"
                      placeholderTextColor="#9CA3AF"
                      value={guestName !== '' ? guestName : (selectedInvoice?.customer?.name || '')}
                      onChangeText={setGuestName}
                    />
                  </View>

                  <View style={styles.guestFieldCol}>
                    <Text style={styles.inputFieldLabel}>Mobile Number *</Text>
                    <TextInput
                      style={styles.guestInput}
                      placeholder="e.g. 0300 1234567"
                      placeholderTextColor="#9CA3AF"
                      value={guestPhone !== '' ? guestPhone : (selectedInvoice?.customer?.phone || '')}
                      onChangeText={setGuestPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitReviewBtn}
                onPress={handleSubmit}
                activeOpacity={0.8}
              >
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                <Text style={styles.submitReviewBtnText}>Submit Royal Feedback & Claim Rewards</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBanner: {
    backgroundColor: '#140306',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#D5A943',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 3,
    marginTop: 6,
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D5A943',
    letterSpacing: 2,
    marginTop: 3,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContentMobile: {
    padding: 14,
  },
  incentiveCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 20,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  incentiveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  incentiveText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  formContainer: {
    gap: 18,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubhint: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 16,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  lookupInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  invoiceSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  invBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  invIdPill: {
    backgroundColor: '#140306',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  invIdText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  invTypePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  invTypeText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  invDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  invServerText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  noInvoiceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  noInvoiceText: {
    fontSize: 12.5,
    color: '#B45309',
    fontWeight: '600',
  },
  dishReviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  dishCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dishQtyBadge: {
    backgroundColor: '#D5A943',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishQtyText: {
    color: '#140306',
    fontWeight: '900',
    fontSize: 13,
  },
  dishNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dishPriceText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  dishRatingRow: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  dishRatingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  starTouch: {
    padding: 2,
  },
  starLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#D5A943',
    marginLeft: 8,
  },
  tagsGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  tagPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D5A943',
  },
  tagPillConstructive: {
    borderColor: '#E2E8F0',
  },
  tagPillConstructiveActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tagPillTextActive: {
    color: '#92400E',
    fontWeight: '700',
  },
  tagPillTextConstructiveActive: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  dishCommentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  overallRatingRow: {
    marginBottom: 14,
  },
  ratingRowTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  generalTextArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13.5,
    color: '#0F172A',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  guestFieldsRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  guestFieldCol: {
    flex: 1,
    minWidth: 200,
  },
  guestInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#140306',
    borderWidth: 1.5,
    borderColor: '#D5A943',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
    marginBottom: 36,
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginTop: 20,
  },
  successIconBubble: {
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#140306',
    letterSpacing: 1,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 480,
  },
  loyaltyRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 18,
  },
  loyaltyRewardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  loyaltyRewardSub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 1,
  },
  voucherBox: {
    backgroundColor: '#140306',
    width: '100%',
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D5A943',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  voucherPre: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D5A943',
    letterSpacing: 2,
  },
  voucherCodeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginVertical: 8,
  },
  voucherTerms: {
    fontSize: 11.5,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  voucherActionsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  shareVoucherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  shareVoucherBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  backHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  backHomeBtnText: {
    color: '#4A121A',
    fontWeight: '800',
    fontSize: 14,
  },
});
