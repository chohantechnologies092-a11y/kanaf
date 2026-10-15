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
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useRestaurantStore,
  Customer,
  CustomerTier,
} from '../../store/restaurantStore';
import { getBaseFeedbackUrl } from '../../utils/qrCode';
import { printInvoiceReceipt } from '../../components/Invoice';

/**
 * Normalizes phone numbers to standard international format (e.g. 03001234567 -> 923001234567)
 * for direct WhatsApp link resolution.
 */
function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith('92') && digits.length === 12) {
    return digits;
  }
  return digits;
}

export default function AdminCustomers() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmallMobile = width < 480;

  const customers = useRestaurantStore((state) => state.customers);
  const invoices = useRestaurantStore((state) => state.invoices);
  const feedbacks = useRestaurantStore((state) => state.feedbacks) || [];
  const onlineFeedbackUrl = useRestaurantStore((state) => state.onlineFeedbackUrl);

  const addCustomer = useRestaurantStore((state) => state.addCustomer);
  const updateCustomer = useRestaurantStore((state) => state.updateCustomer);
  const deleteCustomer = useRestaurantStore((state) => state.deleteCustomer);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | CustomerTier>('All');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'points' | 'recent'>('spent');

  // Customer 360 Dossier Modal
  const [dossierCustomer, setDossierCustomer] = useState<Customer | null>(null);
  const [dossierTab, setDossierTab] = useState<'orders' | 'feedback' | 'notes'>('orders');

  // WhatsApp Messaging Modal
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [whatsappTargetCustomer, setWhatsappTargetCustomer] = useState<Customer | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('loyalty');
  const [customMessage, setCustomMessage] = useState<string>('');

  // Add / Edit Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTier, setFormTier] = useState<CustomerTier>('Regular');
  const [formNotes, setFormNotes] = useState('');
  const [formTags, setFormTags] = useState('');

  // Financial KPIs
  const totalSpentAll = useMemo(
    () => customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
    [customers]
  );
  const totalOrdersAll = useMemo(
    () => customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0),
    [customers]
  );
  const vipCount = useMemo(
    () => customers.filter((c) => c.tier === 'VIP' || c.tier === 'Gold').length,
    [customers]
  );
  const avgRating = useMemo(() => {
    if (feedbacks.length === 0) return 4.9;
    const sum = feedbacks.reduce((acc, f) => acc + (f.overallRating || 5), 0);
    return (sum / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  // Filtered & Sorted Customer List
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q)) ||
          (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (tierFilter !== 'All') {
      result = result.filter((c) => (c.tier || 'Regular') === tierFilter);
    }

    result.sort((a, b) => {
      if (sortBy === 'spent') return (b.totalSpent || 0) - (a.totalSpent || 0);
      if (sortBy === 'orders') return (b.totalOrders || 0) - (a.totalOrders || 0);
      if (sortBy === 'points') return (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0);
      if (sortBy === 'recent') return (b.lastVisit || 0) - (a.lastVisit || 0);
      return 0;
    });

    return result;
  }, [customers, searchQuery, tierFilter, sortBy]);

  // Get Invoices for Dossier Customer
  const customerInvoices = useMemo(() => {
    if (!dossierCustomer) return [];
    const cleanPhone = dossierCustomer.phone.replace(/\D/g, '');
    return invoices.filter((inv) => {
      const isIdMatch = inv.customer?.id && inv.customer.id === dossierCustomer.id;
      const invCustPhone = (inv.customer?.phone || '').replace(/\D/g, '');
      const isPhoneMatch =
        cleanPhone &&
        invCustPhone &&
        (cleanPhone.endsWith(invCustPhone) || invCustPhone.endsWith(cleanPhone));
      return isIdMatch || isPhoneMatch;
    });
  }, [dossierCustomer, invoices]);

  // Get Feedbacks for Dossier Customer
  const customerFeedbacks = useMemo(() => {
    if (!dossierCustomer) return [];
    const cleanPhone = dossierCustomer.phone.replace(/\D/g, '');
    return feedbacks.filter((fb) => {
      const isIdMatch = fb.customerId && fb.customerId === dossierCustomer.id;
      const fbPhone = (fb.customerPhone || '').replace(/\D/g, '');
      const isPhoneMatch =
        cleanPhone && fbPhone && (cleanPhone.endsWith(fbPhone) || fbPhone.endsWith(cleanPhone));
      return isIdMatch || isPhoneMatch;
    });
  }, [dossierCustomer, feedbacks]);

  // Helper for Initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Tier Badge Color Map
  const getTierBadgeStyle = (tier?: CustomerTier) => {
    switch (tier) {
      case 'VIP':
        return { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', icon: 'diamond' };
      case 'Gold':
        return { bg: '#FFFBEB', border: '#FBBF24', text: '#B45309', icon: 'trophy' };
      case 'Silver':
        return { bg: '#F1F5F9', border: '#94A3B8', text: '#334155', icon: 'shield-checkmark' };
      default:
        return { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', icon: 'person' };
    }
  };

  // Add / Edit Handlers
  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormTier('Regular');
    setFormNotes('');
    setFormTags('');
    setEditModalVisible(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email || '');
    setFormAddress(cust.address || '');
    setFormTier(cust.tier || 'Regular');
    setFormNotes(cust.notes || '');
    setFormTags((cust.tags || []).join(', '));
    setEditModalVisible(true);
  };

  const handleSaveCustomer = () => {
    if (!formName.trim() || !formPhone.trim()) {
      const msg = 'Customer name and mobile number are required.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Validation Error', msg);
      return;
    }

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        tier: formTier,
        notes: formNotes.trim() || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      if (dossierCustomer?.id === editingCustomer.id) {
        setDossierCustomer({
          ...dossierCustomer,
          name: formName.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim() || undefined,
          address: formAddress.trim() || undefined,
          tier: formTier,
          notes: formNotes.trim() || undefined,
          tags: tagsArray.length > 0 ? tagsArray : undefined,
        });
      }
    } else {
      addCustomer({
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        tier: formTier,
        notes: formNotes.trim() || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        loyaltyPoints: 50,
      });
    }
    setEditModalVisible(false);
  };

  const handleDelete = (cust: Customer) => {
    const doDelete = () => {
      deleteCustomer(cust.id);
      if (dossierCustomer?.id === cust.id) {
        setDossierCustomer(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete customer "${cust.name}"?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Customer',
        `Are you sure you want to remove customer record for "${cust.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // WhatsApp Messaging Logic
  const openWhatsAppModal = (cust: Customer) => {
    setWhatsappTargetCustomer(cust);
    setSelectedTemplateKey('loyalty');
    setCustomMessage(buildWhatsAppMessage(cust, 'loyalty'));
    setWhatsappModalVisible(true);
  };

  const buildWhatsAppMessage = (cust: Customer, templateKey: string): string => {
    const feedbackUrl = `${getBaseFeedbackUrl(onlineFeedbackUrl)}/feedback`;
    const tier = cust.tier || 'Regular';
    const points = cust.loyaltyPoints || 50;

    switch (templateKey) {
      case 'loyalty':
        return `Assalam-o-Alaikum ${cust.name}! 🌟\n\nThank you for dining with Sultan Restaurant. Your VIP status is *${tier}* with *${points} Sultan Loyalty Points*.\n\nWe hope you enjoyed our royal cuisine and look forward to welcoming you back soon!\n\n👑 *Sultan Restaurant* - Luxury Dining & Banquet`;

      case 'voucher':
        return `Assalam-o-Alaikum ${cust.name}! 🎁\n\nAs a valued Sultan guest, we are thrilled to offer you an exclusive *10% Royal Discount* on your next visit!\n\n🎟️ Use Voucher Code: *SULTAN-VIP10*\nShow this code when placing your dine-in or takeaway order. Valid this week.\n\n👑 *Sultan Restaurant*`;

      case 'feedback':
        return `Assalam-o-Alaikum ${cust.name}! ⭐\n\nWe value your opinion! Please take a quick moment to rate each dish from your recent visit:\n👉 ${feedbackUrl}\n\nGiving feedback automatically credits *+50 Loyalty Points* to your account!\n\n👑 *Sultan Restaurant*`;

      case 'missyou':
        return `Assalam-o-Alaikum ${cust.name}! 🍽️\n\nWe haven't seen you at Sultan Restaurant recently and miss serving you! Your favorite dishes are waiting for you.\n\nVisit us this weekend and enjoy a complimentary dessert on bills over Rs. 3,000.\n\n👑 *Sultan Restaurant* - Food Street, Lahore`;

      case 'custom':
      default:
        return `Assalam-o-Alaikum ${cust.name}!\n\n`;
    }
  };

  const handleTemplateSelect = (key: string) => {
    setSelectedTemplateKey(key);
    if (whatsappTargetCustomer) {
      setCustomMessage(buildWhatsAppMessage(whatsappTargetCustomer, key));
    }
  };

  const sendWhatsAppMessage = () => {
    if (!whatsappTargetCustomer) return;
    const phone = formatWhatsAppPhone(whatsappTargetCustomer.phone);
    if (!phone) {
      const msg = 'Customer does not have a valid mobile number.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Phone', msg);
      return;
    }

    const encodedText = encodeURIComponent(customMessage.trim());
    const waUrl = `https://wa.me/${phone}?text=${encodedText}`;

    if (Platform.OS === 'web') {
      window.open(waUrl, '_blank');
    } else {
      Linking.openURL(waUrl);
    }
    setWhatsappModalVisible(false);
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Top Header */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="people" size={24} color="#D5A943" />
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              Customer CRM & Loyalty Hub
            </Text>
          </View>
          <Text style={styles.subtitle}>
            Comprehensive 360° guest records, WhatsApp messaging & dish ratings
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, isMobile && styles.addButtonMobile]}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={17} color="#140306" style={{ marginRight: 6 }} />
          <Text style={styles.addButtonText}>Register New Customer</Text>
        </TouchableOpacity>
      </View>

      {/* 4 KPI Metrics Header */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconWrap}>
            <Ionicons name="people-outline" size={20} color="#1976D2" />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Total Diners</Text>
            <Text style={styles.kpiValue}>{customers.length}</Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="diamond-outline" size={20} color="#D97706" />
          </View>
          <View>
            <Text style={styles.kpiLabel}>VIP & Gold Guests</Text>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>{vipCount}</Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="wallet-outline" size={20} color="#16A34A" />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Lifetime Revenue</Text>
            <Text style={[styles.kpiValue, { color: '#15803D' }]}>
              Rs. {totalSpentAll.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="star" size={20} color="#9333EA" />
          </View>
          <View>
            <Text style={styles.kpiLabel}>Guest Feedback</Text>
            <Text style={[styles.kpiValue, { color: '#7E22CE' }]}>
              ⭐ {avgRating} ({feedbacks.length})
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar & Tier Tabs */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, email, notes, or tags..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tier Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tierTabsRow}
        >
          {(['All', 'VIP', 'Gold', 'Silver', 'Regular'] as const).map((tier) => {
            const count =
              tier === 'All'
                ? customers.length
                : customers.filter((c) => (c.tier || 'Regular') === tier).length;
            const isSelected = tierFilter === tier;

            return (
              <TouchableOpacity
                key={tier}
                style={[styles.tierTab, isSelected && styles.tierTabSelected]}
                onPress={() => setTierFilter(tier)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tierTabText, isSelected && styles.tierTabTextSelected]}
                >
                  {tier === 'VIP' ? '👑 VIP' : tier === 'Gold' ? '🥇 Gold' : tier === 'Silver' ? '🥈 Silver' : tier} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Customer Cards List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={54} color="#CBD5E1" />
            <Text style={styles.emptyText}>No customers found</Text>
            <Text style={styles.emptySubtext}>
              No guests match your search criteria. Try a different query or register a customer.
            </Text>
          </View>
        ) : (
          filteredCustomers.map((cust) => {
            const badge = getTierBadgeStyle(cust.tier);

            return (
              <View key={cust.id} style={[styles.card, isMobile && styles.cardMobile]}>
                <View style={styles.cardMainRow}>
                  {/* Left Avatar & Tier */}
                  <View style={styles.avatarCol}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(cust.name)}</Text>
                    </View>
                    <View
                      style={[
                        styles.tierBadge,
                        { backgroundColor: badge.bg, borderColor: badge.border },
                      ]}
                    >
                      <Ionicons name={badge.icon as any} size={11} color={badge.text} style={{ marginRight: 3 }} />
                      <Text style={[styles.tierBadgeText, { color: badge.text }]}>
                        {cust.tier || 'Regular'}
                      </Text>
                    </View>
                  </View>

                  {/* Center Details */}
                  <View style={styles.infoCol}>
                    <View style={styles.custNameRow}>
                      <Text style={styles.custName}>{cust.name}</Text>
                      <View style={styles.pointsPill}>
                        <Ionicons name="sparkles" size={12} color="#D5A943" style={{ marginRight: 3 }} />
                        <Text style={styles.pointsPillText}>
                          {cust.loyaltyPoints || 50} Pts
                        </Text>
                      </View>
                    </View>

                    {/* Phone & Email */}
                    <View style={styles.contactDetailsRow}>
                      <View style={styles.contactItem}>
                        <Ionicons name="call" size={13} color="#D5A943" style={{ marginRight: 4 }} />
                        <Text style={styles.contactText}>{cust.phone}</Text>
                      </View>
                      {cust.email ? (
                        <View style={styles.contactItem}>
                          <Ionicons name="mail" size={13} color="#64748B" style={{ marginRight: 4 }} />
                          <Text style={styles.contactText}>{cust.email}</Text>
                        </View>
                      ) : null}
                    </View>

                    {cust.address ? (
                      <View style={styles.contactItem}>
                        <Ionicons name="location" size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                        <Text style={styles.addressText} numberOfLines={1}>
                          {cust.address}
                        </Text>
                      </View>
                    ) : null}

                    {/* Tags */}
                    {cust.tags && cust.tags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {cust.tags.map((tag, idx) => (
                          <View key={idx} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Notes preview */}
                    {cust.notes ? (
                      <View style={styles.notePreviewBox}>
                        <Ionicons name="chatbox-ellipses-outline" size={12} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.notePreviewText} numberOfLines={1}>
                          {cust.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Right Stats & Spend */}
                  <View style={styles.statsCol}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Lifetime Spent</Text>
                      <Text style={styles.statValSpend}>
                        Rs. {(cust.totalSpent || 0).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Total Orders</Text>
                      <Text style={styles.statValOrders}>{cust.totalOrders || 0} Visits</Text>
                    </View>
                  </View>
                </View>

                {/* Card Bottom Actions Row */}
                <View style={[styles.cardFooter, isMobile && styles.cardFooterMobile]}>
                  {/* WhatsApp Direct Messaging Button */}
                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={() => openWhatsAppModal(cust)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.whatsappBtnText}>Send WhatsApp</Text>
                  </TouchableOpacity>

                  {/* 360 Dossier / Orders Button */}
                  <TouchableOpacity
                    style={styles.dossierBtn}
                    onPress={() => {
                      setDossierCustomer(cust);
                      setDossierTab('orders');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="receipt-outline" size={15} color="#140306" style={{ marginRight: 6 }} />
                    <Text style={styles.dossierBtnText}>Full Records & History</Text>
                  </TouchableOpacity>

                  {/* Edit Button */}
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditModal(cust)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pencil" size={14} color="#475569" />
                  </TouchableOpacity>

                  {/* Delete Button */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(cust)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ========================================================
          1. WHATSAPP MESSAGING MODAL
          ======================================================== */}
      <Modal visible={whatsappModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.whatsappModalCard, isMobile && styles.modalContentMobile]}>
            <View style={styles.whatsappModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.whatsappIconCircle}>
                  <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.modalHeaderTitle}>WhatsApp Direct Message</Text>
                  <Text style={styles.modalHeaderSub}>
                    To: {whatsappTargetCustomer?.name} ({whatsappTargetCustomer?.phone})
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setWhatsappModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Template Selector */}
            <Text style={styles.fieldSectionTitle}>Choose Message Template:</Text>
            <View style={styles.templateOptionsRow}>
              {[
                { key: 'loyalty', label: '👑 VIP Loyalty Points' },
                { key: 'voucher', label: '🎁 10% Royal Voucher' },
                { key: 'feedback', label: '⭐ Dish Review Request' },
                { key: 'missyou', label: '🍽️ We Miss You' },
                { key: 'custom', label: '✍️ Custom Message' },
              ].map((tpl) => (
                <TouchableOpacity
                  key={tpl.key}
                  style={[
                    styles.templatePill,
                    selectedTemplateKey === tpl.key && styles.templatePillActive,
                  ]}
                  onPress={() => handleTemplateSelect(tpl.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.templatePillText,
                      selectedTemplateKey === tpl.key && styles.templatePillTextActive,
                    ]}
                  >
                    {tpl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Editable Preview Box */}
            <Text style={styles.fieldSectionTitle}>Message Preview & Edit:</Text>
            <TextInput
              style={styles.messageTextArea}
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              numberOfLines={6}
              placeholder="Type your WhatsApp message..."
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setWhatsappModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSendWhatsAppBtn}
                onPress={sendWhatsAppMessage}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.modalSendWhatsAppBtnText}>Open WhatsApp & Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          2. CUSTOMER 360 DOSSIER & ORDER HISTORY MODAL
          ======================================================== */}
      <Modal visible={!!dossierCustomer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.dossierModalCard, isMobile && styles.modalContentMobile]}>
            {dossierCustomer && (
              <>
                {/* Dossier Header */}
                <View style={styles.dossierHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.dossierAvatar}>
                      <Text style={styles.dossierAvatarText}>
                        {getInitials(dossierCustomer.name)}
                      </Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.dossierName}>{dossierCustomer.name}</Text>
                        <View style={styles.pointsPill}>
                          <Ionicons name="sparkles" size={12} color="#D5A943" style={{ marginRight: 3 }} />
                          <Text style={styles.pointsPillText}>
                            {dossierCustomer.loyaltyPoints || 50} Pts
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dossierPhone}>{dossierCustomer.phone}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setDossierCustomer(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Lifetime KPI Summary */}
                <View style={styles.dossierKpiRow}>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>Tier</Text>
                    <Text style={styles.dossierKpiVal}>{dossierCustomer.tier || 'Regular'}</Text>
                  </View>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>Lifetime Spent</Text>
                    <Text style={[styles.dossierKpiVal, { color: '#15803D' }]}>
                      Rs. {(dossierCustomer.totalSpent || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>Total Visits</Text>
                    <Text style={styles.dossierKpiVal}>{dossierCustomer.totalOrders || 0}</Text>
                  </View>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>Average Spend</Text>
                    <Text style={styles.dossierKpiVal}>
                      Rs.{' '}
                      {dossierCustomer.totalOrders
                        ? Math.round(dossierCustomer.totalSpent / dossierCustomer.totalOrders).toLocaleString()
                        : '0'}
                    </Text>
                  </View>
                </View>

                {/* Sub-tabs */}
                <View style={styles.dossierTabsRow}>
                  <TouchableOpacity
                    style={[styles.dossierTab, dossierTab === 'orders' && styles.dossierTabActive]}
                    onPress={() => setDossierTab('orders')}
                  >
                    <Ionicons name="receipt-outline" size={15} color={dossierTab === 'orders' ? '#140306' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.dossierTabText, dossierTab === 'orders' && styles.dossierTabTextActive]}>
                      Invoices & Bills ({customerInvoices.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dossierTab, dossierTab === 'feedback' && styles.dossierTabActive]}
                    onPress={() => setDossierTab('feedback')}
                  >
                    <Ionicons name="star-outline" size={15} color={dossierTab === 'feedback' ? '#140306' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.dossierTabText, dossierTab === 'feedback' && styles.dossierTabTextActive]}>
                      Dish Reviews ({customerFeedbacks.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dossierTab, dossierTab === 'notes' && styles.dossierTabActive]}
                    onPress={() => setDossierTab('notes')}
                  >
                    <Ionicons name="document-text-outline" size={15} color={dossierTab === 'notes' ? '#140306' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={[styles.dossierTabText, dossierTab === 'notes' && styles.dossierTabTextActive]}>
                      Notes & Profile
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <ScrollView style={styles.dossierScroll} showsVerticalScrollIndicator={false}>
                  {dossierTab === 'orders' && (
                    <View style={{ gap: 10 }}>
                      {customerInvoices.length === 0 ? (
                        <Text style={styles.tabEmptyText}>
                          No previous orders or bills found for this customer.
                        </Text>
                      ) : (
                        customerInvoices.map((inv) => (
                          <View key={inv.id} style={styles.dossierOrderCard}>
                            <View style={styles.dossierOrderHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.dossierOrderId}>#{inv.id}</Text>
                                <View style={styles.dossierTypeBadge}>
                                  <Text style={styles.dossierTypeBadgeText}>
                                    {inv.orderType.toUpperCase()}
                                    {inv.tableName ? ` • ${inv.tableName}` : ''}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.dossierOrderDate}>
                                {new Date(inv.timeSettled || inv.timePlaced).toLocaleDateString()}
                              </Text>
                            </View>

                            {/* Items list */}
                            <Text style={styles.dossierOrderItems} numberOfLines={2}>
                              {(inv.items || []).map((it) => `${it.qty}x ${it.name}`).join(', ')}
                            </Text>

                            <View style={styles.dossierOrderFooter}>
                              <Text style={styles.dossierOrderTotal}>
                                Total: Rs. {(inv.total || 0).toLocaleString()}
                              </Text>
                              <TouchableOpacity
                                style={styles.dossierPrintBtn}
                                onPress={() => printInvoiceReceipt(inv)}
                                activeOpacity={0.8}
                              >
                                <Ionicons name="print-outline" size={14} color="#140306" style={{ marginRight: 4 }} />
                                <Text style={styles.dossierPrintBtnText}>Print Bill</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  {dossierTab === 'feedback' && (
                    <View style={{ gap: 12 }}>
                      {customerFeedbacks.length === 0 ? (
                        <Text style={styles.tabEmptyText}>
                          No item-wise feedback submitted by this customer yet.
                        </Text>
                      ) : (
                        customerFeedbacks.map((fb) => (
                          <View key={fb.id} style={styles.dossierFeedbackCard}>
                            <View style={styles.dossierFeedbackHeader}>
                              <Text style={styles.dossierFeedbackScore}>
                                ⭐ {fb.overallRating}/5 Rating
                              </Text>
                              <Text style={styles.dossierOrderDate}>
                                Bill #{fb.invoiceId} • {new Date(fb.createdAt).toLocaleDateString()}
                              </Text>
                            </View>

                            {fb.generalComments && (
                              <Text style={styles.dossierFeedbackComment}>
                                {'“'}{fb.generalComments}{'”'}
                              </Text>
                            )}

                            {/* Item Ratings */}
                            {fb.items && fb.items.length > 0 && (
                              <View style={styles.dishFeedbackList}>
                                {fb.items.map((it, idx) => (
                                  <View key={idx} style={styles.dishFeedbackRow}>
                                    <Text style={styles.dishFeedbackName}>
                                      {it.itemName}: ⭐ {it.rating}/5
                                    </Text>
                                    {it.tags && it.tags.length > 0 && (
                                      <Text style={styles.dishFeedbackTags}>
                                        {it.tags.join(', ')}
                                      </Text>
                                    )}
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  {dossierTab === 'notes' && (
                    <View style={styles.dossierProfileSection}>
                      <Text style={styles.dossierSectionHeading}>Address & Location</Text>
                      <Text style={styles.dossierSectionBody}>
                        {dossierCustomer.address || 'No delivery/billing address saved.'}
                      </Text>

                      <Text style={[styles.dossierSectionHeading, { marginTop: 14 }]}>
                        Staff Notes & Dietary Preferences
                      </Text>
                      <Text style={styles.dossierSectionBody}>
                        {dossierCustomer.notes || 'No special notes recorded for this diner.'}
                      </Text>

                      <Text style={[styles.dossierSectionHeading, { marginTop: 14 }]}>
                        Customer Tags
                      </Text>
                      <View style={styles.tagsRow}>
                        {(dossierCustomer.tags || ['Regular Diner']).map((t, idx) => (
                          <View key={idx} style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>#{t}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Dossier Bottom Actions */}
                <View style={styles.dossierActionRow}>
                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={() => {
                      setDossierCustomer(null);
                      openWhatsAppModal(dossierCustomer);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.whatsappBtnText}>Send WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${dossierCustomer.phone}`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={15} color="#140306" style={{ marginRight: 6 }} />
                    <Text style={styles.callBtnText}>Call Customer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      setDossierCustomer(null);
                      openEditModal(dossierCustomer);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pencil" size={15} color="#475569" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================
          3. ADD / EDIT CUSTOMER MODAL
          ======================================================== */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && styles.modalContentMobile]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Zubair Tariq"
                placeholderTextColor="#94A3B8"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Mobile Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0300 1234567"
                placeholderTextColor="#94A3B8"
                value={formPhone}
                onChangeText={setFormPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email Address (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. zubair@example.com"
                placeholderTextColor="#94A3B8"
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Loyalty Tier</Text>
              <View style={styles.tierSelectRow}>
                {(['Regular', 'Silver', 'Gold', 'VIP'] as CustomerTier[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tierSelectPill, formTier === t && styles.tierSelectPillActive]}
                    onPress={() => setFormTier(t)}
                  >
                    <Text
                      style={[
                        styles.tierSelectPillText,
                        formTier === t && styles.tierSelectPillTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Delivery / Billing Address</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. House 45, Street 12, Phase 5, DHA..."
                placeholderTextColor="#94A3B8"
                value={formAddress}
                onChangeText={setFormAddress}
                multiline
              />

              <Text style={styles.label}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spicy Food, Family Regular, VIP Majlis"
                placeholderTextColor="#94A3B8"
                value={formTags}
                onChangeText={setFormTags}
              />

              <Text style={styles.label}>Private Staff Notes / Dietary Restrictions</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. Prefers less oil, always sits on Table 4, allergic to peanuts..."
                placeholderTextColor="#94A3B8"
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCustomer}>
                <Text style={styles.saveBtnText}>
                  {editingCustomer ? 'Update Profile' : 'Save Customer'}
                </Text>
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
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  containerMobile: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  titleMobile: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#D5A943',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#D5A943',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addButtonMobile: {
    width: '100%',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#140306',
    fontWeight: '800',
    fontSize: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  filterSection: {
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    padding: 0,
  },
  tierTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  tierTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierTabSelected: {
    backgroundColor: '#140306',
    borderColor: '#D5A943',
  },
  tierTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tierTabTextSelected: {
    color: '#F8FAFC',
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardMobile: {
    padding: 14,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 14,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#140306',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D5A943',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  infoCol: {
    flex: 1,
  },
  custNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  custName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pointsPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  contactDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  tagBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  notePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  notePreviewText: {
    fontSize: 11.5,
    color: '#92400E',
  },
  statsCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  statBox: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statValSpend: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  statValOrders: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  cardFooterMobile: {
    justifyContent: 'space-between',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  dossierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dossierBtnText: {
    color: '#140306',
    fontWeight: '700',
    fontSize: 13,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  callBtnText: {
    color: '#140306',
    fontWeight: '700',
    fontSize: 13,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  whatsappModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 580,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  whatsappModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  whatsappIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  fieldSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  templateOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  templatePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  templatePillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#25D366',
  },
  templatePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  templatePillTextActive: {
    color: '#15803D',
  },
  messageTextArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 13.5,
    color: '#0F172A',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSendWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  modalSendWhatsAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  dossierModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  dossierAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#140306',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D5A943',
  },
  dossierAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  dossierName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dossierPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  dossierKpiRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  dossierKpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  dossierKpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  dossierKpiVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  dossierTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  dossierTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  dossierTabActive: {
    borderBottomColor: '#140306',
  },
  dossierTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  dossierTabTextActive: {
    color: '#140306',
  },
  dossierScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  dossierOrderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dossierOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dossierOrderId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dossierTypeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dossierTypeBadgeText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700',
  },
  dossierOrderDate: {
    fontSize: 11.5,
    color: '#64748B',
  },
  dossierOrderItems: {
    fontSize: 12.5,
    color: '#475569',
    marginBottom: 8,
  },
  dossierOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dossierOrderTotal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#15803D',
  },
  dossierPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dossierPrintBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#140306',
  },
  dossierFeedbackCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dossierFeedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dossierFeedbackScore: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#D97706',
  },
  dossierFeedbackComment: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  dishFeedbackList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  dishFeedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dishFeedbackName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  dishFeedbackTags: {
    fontSize: 11,
    color: '#64748B',
  },
  dossierProfileSection: {
    padding: 4,
  },
  dossierSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  dossierSectionBody: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  dossierActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tabEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 30,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 520,
  },
  modalContentMobile: {
    padding: 16,
    maxWidth: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
  },
  tierSelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierSelectPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  tierSelectPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D5A943',
  },
  tierSelectPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  tierSelectPillTextActive: {
    color: '#92400E',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#140306',
    borderWidth: 1,
    borderColor: '#D5A943',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
