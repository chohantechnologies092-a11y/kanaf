import React, { useMemo, useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRestaurantStore, Floor } from '../../store/restaurantStore';
import { getFloorMeta, getTableFloor, getTableSeatingType } from '../../constants/floors';
import SeatingTypeIcon from '../../components/SeatingTypeIcon';

const BRAND_COLOR = '#4a121a';

type IconName = keyof typeof Ionicons.glyphMap;

const COLOR_PRESETS = [
  { name: 'Emerald', value: '#2E7D32' },
  { name: 'Royal Blue', value: '#1976D2' },
  { name: 'Regal Purple', value: '#6A1B9A' },
  { name: 'Sultan Gold', value: '#B8860B' },
  { name: 'Sunset Amber', value: '#E65100' },
  { name: 'Sultan Burgundy', value: '#4a121a' },
  { name: 'Crimson Red', value: '#C0392B' },
  { name: 'Slate Teal', value: '#00897B' },
];

const ICON_PRESETS: { icon: IconName; label: string }[] = [
  { icon: 'restaurant-outline', label: 'Dining' },
  { icon: 'people-outline', label: 'Hall' },
  { icon: 'sparkles-outline', label: 'Banquet' },
  { icon: 'diamond-outline', label: 'VIP' },
  { icon: 'moon-outline', label: 'Rooftop' },
  { icon: 'business-outline', label: 'Level' },
  { icon: 'cafe-outline', label: 'Lounge' },
  { icon: 'wine-outline', label: 'Bar' },
  { icon: 'layers-outline', label: 'Floor' },
];

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function AdminFloorsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const columns = width < 700 ? 1 : width < 1200 ? 2 : 3;

  const floors = useRestaurantStore((s) => s.floors) || [];
  const tables = useRestaurantStore((s) => s.tables) || [];
  const addFloor = useRestaurantStore((s) => s.addFloor);
  const updateFloor = useRestaurantStore((s) => s.updateFloor);
  const deleteFloor = useRestaurantStore((s) => s.deleteFloor);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#1976D2');
  const [formIcon, setFormIcon] = useState<IconName>('business-outline');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Floor | null>(null);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalFloors = floors.length;
    const totalTables = tables.filter((t) => getTableSeatingType(t) === 'tables').length;
    const totalCouches = tables.filter((t) => getTableSeatingType(t) === 'couches').length;
    const totalCabins = tables.filter((t) => getTableSeatingType(t) === 'majlis').length;
    const totalSeats = tables.reduce((sum, t) => sum + (t.seats || 0), 0);
    const occupiedSeats = tables.filter((t) => t.status === 'occupied' || t.status === 'billed').reduce((sum, t) => sum + (t.seats || 0), 0);
    return {
      totalFloors,
      totalTables,
      totalCouches,
      totalCabins,
      totalSeats,
      occupiedSeats,
    };
  }, [floors, tables]);

  // ---------- Modal Helpers ----------
  const openAddModal = () => {
    setEditingFloor(null);
    setFormName('');
    setFormShortCode('');
    setFormPrefix('');
    setFormDescription('');
    setFormColor('#1976D2');
    setFormIcon('business-outline');
    setModalVisible(true);
  };

  const openEditModal = (floor: Floor) => {
    setEditingFloor(floor);
    setFormName(floor.name);
    setFormShortCode(floor.shortCode || floor.name.slice(0, 2).toUpperCase());
    setFormPrefix(floor.prefix || floor.shortCode || 'F');
    setFormDescription(floor.description || '');
    setFormColor(floor.color || '#1976D2');
    setFormIcon((floor.icon as IconName) || 'business-outline');
    setModalVisible(true);
  };

  const handleSaveFloor = () => {
    const name = formName.trim();
    if (!name) return notify('Missing name', 'Please enter a floor name.');

    const shortCode = formShortCode.trim().toUpperCase() || name.slice(0, 2).toUpperCase();
    const prefix = formPrefix.trim().toUpperCase() || shortCode;

    // Duplicate check
    const duplicate = floors.some(
      (f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== editingFloor?.id
    );
    if (duplicate) return notify('Duplicate name', `A floor named "${name}" already exists.`);

    if (editingFloor) {
      updateFloor(editingFloor.id, {
        name,
        shortCode,
        prefix,
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
      });
      notify('Floor Updated', `Successfully updated "${name}". Tables and staff have been synced.`);
    } else {
      addFloor({
        name,
        shortCode,
        prefix,
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
      });
      notify('Floor Added', `Successfully created "${name}". You can now add tables, couches and majlis cabins to it.`);
    }
    setModalVisible(false);
  };

  const handleDeleteFloor = (floor: Floor) => {
    const floorTables = tables.filter((t) => getTableFloor(t).toLowerCase() === floor.name.toLowerCase());
    const busy = floorTables.filter((t) => t.status === 'occupied' || t.status === 'billed');

    if (busy.length > 0) {
      return notify(
        'Cannot Delete Floor',
        `There are ${busy.length} table(s) with active orders or bills on ${floor.name}. Please settle all bills before deleting.`
      );
    }

    setDeleteTarget(floor);
  };

  const confirmDeleteFloor = (deleteTablesTogether: boolean) => {
    if (!deleteTarget) return;
    deleteFloor(deleteTarget.id, deleteTablesTogether);
    const deletedName = deleteTarget.name;
    setDeleteTarget(null);
    notify('Floor Deleted', `"${deletedName}" has been removed.`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/dashboard'))}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Floor Management</Text>
            <Text style={styles.headerSubtitle}>Create, edit & manage multi-level restaurant floors</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGhost]}
            onPress={() => router.push('/admin/tables')}
          >
            <Ionicons name="grid-outline" size={16} color="#D5A943" />
            {!isMobile && <Text style={[styles.actionBtnText, { color: '#D5A943' }]}>Tables & Cabins</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={openAddModal}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>+ Add Floor</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Summary Row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#4a121a15' }]}>
              <Ionicons name="business-outline" size={18} color="#4a121a" />
            </View>
            <View>
              <Text style={styles.kpiValue}>{stats.totalFloors}</Text>
              <Text style={styles.kpiLabel}>Total Floors</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#1976D215' }]}>
              <SeatingTypeIcon type="tables" size={18} color="#1976D2" />
            </View>
            <View>
              <Text style={styles.kpiValue}>{stats.totalTables}</Text>
              <Text style={styles.kpiLabel}>Dining Tables</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#E6510015' }]}>
              <SeatingTypeIcon type="couches" size={18} color="#E65100" />
            </View>
            <View>
              <Text style={styles.kpiValue}>{stats.totalCouches}</Text>
              <Text style={styles.kpiLabel}>Couches</Text>
            </View>
          </View>

          <View style={[styles.kpiCard, { borderColor: '#4a121a40', backgroundColor: '#FFFAF7' }]}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#4a121a20' }]}>
              <SeatingTypeIcon type="majlis" size={18} color="#4a121a" />
            </View>
            <View>
              <Text style={[styles.kpiValue, { color: '#4a121a' }]}>{stats.totalCabins} Cabins</Text>
              <Text style={[styles.kpiLabel, { color: '#4a121a', fontWeight: '800' }]}>Majlis Sitting</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconBox, { backgroundColor: '#2E7D3215' }]}>
              <Ionicons name="people-outline" size={18} color="#2E7D32" />
            </View>
            <View>
              <Text style={styles.kpiValue}>{stats.totalSeats} Guests</Text>
              <Text style={styles.kpiLabel}>Total Capacity</Text>
            </View>
          </View>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Configured Restaurant Floors ({floors.length})</Text>
          <Text style={styles.sectionSub}>Add new floors or edit existing ones. Changes sync live across POS and Order Takers.</Text>
        </View>

        {/* Floors Grid */}
        <View style={styles.floorsGrid}>
          {floors.map((floor) => {
            const meta = getFloorMeta(floor.name, floors);
            const floorTables = tables.filter((t) => getTableFloor(t).toLowerCase() === floor.name.toLowerCase());
            const tableItems = floorTables.filter((t) => getTableSeatingType(t) === 'tables');
            const couchItems = floorTables.filter((t) => getTableSeatingType(t) === 'couches');
            const majlisItems = floorTables.filter((t) => getTableSeatingType(t) === 'majlis');
            const totalFloorSeats = floorTables.reduce((s, t) => s + (t.seats || 0), 0);
            const majlisSeats = majlisItems.reduce((s, t) => s + (t.seats || 0), 0);

            return (
              <View
                key={floor.id}
                style={[styles.floorCard, { width: `${100 / columns}%` }]}
              >
                <View style={[styles.floorCardInner, { borderColor: (floor.color || meta.color) + '40' }]}>
                  {/* Top Bar Indicator */}
                  <View style={[styles.floorTopBar, { backgroundColor: floor.color || meta.color }]} />

                  {/* Header Row */}
                  <View style={styles.floorCardTopRow}>
                    <View style={[styles.floorIconBadge, { backgroundColor: (floor.color || meta.color) + '18' }]}>
                      <Ionicons name={(floor.icon as IconName) || meta.icon} size={22} color={floor.color || meta.color} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.floorName}>{floor.name}</Text>
                        <View style={[styles.shortBadge, { backgroundColor: (floor.color || meta.color) + '20' }]}>
                          <Text style={[styles.shortBadgeText, { color: floor.color || meta.color }]}>
                            {floor.shortCode || meta.short}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.floorPrefix}>
                        Prefix: <Text style={{ fontWeight: '800', color: '#1C1C1E' }}>{floor.prefix || meta.prefix}-XX</Text>
                      </Text>
                    </View>

                    {/* Edit & Delete Action Buttons */}
                    <View style={styles.cardHeaderButtons}>
                      <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#F2F2F7' }]}
                        onPress={() => openEditModal(floor)}
                        hitSlop={6}
                      >
                        <Ionicons name="pencil" size={15} color="#1C1C1E" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: '#FDEDEC' }]}
                        onPress={() => handleDeleteFloor(floor)}
                        hitSlop={6}
                      >
                        <Ionicons name="trash-outline" size={15} color="#D64541" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Description / Blurb */}
                  <Text style={styles.floorBlurb} numberOfLines={2}>
                    {floor.description || meta.blurb || 'Standard restaurant level for dining & guests.'}
                  </Text>

                  {/* 3 Seating Zones Counters */}
                  <View style={styles.zoneCountersContainer}>
                    {/* Tables */}
                    <View style={styles.zoneCounterItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <SeatingTypeIcon type="tables" size={14} color="#1976D2" />
                        <Text style={styles.zoneCounterTitle}>Tables</Text>
                      </View>
                      <Text style={styles.zoneCounterValue}>{tableItems.length}</Text>
                      <Text style={styles.zoneCounterSub}>{tableItems.reduce((s, t) => s + (t.seats || 0), 0)} Seats</Text>
                    </View>

                    {/* Couches */}
                    <View style={styles.zoneCounterItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <SeatingTypeIcon type="couches" size={14} color="#E65100" />
                        <Text style={styles.zoneCounterTitle}>Couches</Text>
                      </View>
                      <Text style={styles.zoneCounterValue}>{couchItems.length}</Text>
                      <Text style={styles.zoneCounterSub}>{couchItems.reduce((s, t) => s + (t.seats || 0), 0)} Seats</Text>
                    </View>

                    {/* Majlis Sitting Cabins */}
                    <View style={[styles.zoneCounterItem, { backgroundColor: '#4a121a10', borderColor: '#4a121a30' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <SeatingTypeIcon type="majlis" size={14} color="#4a121a" />
                        <Text style={[styles.zoneCounterTitle, { color: '#4a121a' }]}>Majlis</Text>
                      </View>
                      <Text style={[styles.zoneCounterValue, { color: '#4a121a' }]}>{majlisItems.length} Cabins</Text>
                      <Text style={[styles.zoneCounterSub, { color: '#4a121a', fontWeight: '800' }]}>{majlisSeats} Guests Cap</Text>
                    </View>
                  </View>

                  {/* Total Capacity Bar */}
                  <View style={styles.capacityBar}>
                    <Text style={styles.capacityBarText}>
                      Total Capacity: <Text style={{ fontWeight: '800', color: '#1C1C1E' }}>{totalFloorSeats} Guests</Text> • {floorTables.length} Total Units
                    </Text>
                  </View>

                  {/* Link to Table Management */}
                  <TouchableOpacity
                    style={[styles.manageTablesBtn, { backgroundColor: floor.color || meta.color }]}
                    onPress={() => router.push(`/admin/tables?prefillFloor=${encodeURIComponent(floor.name)}` as any)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="grid-outline" size={15} color="#fff" />
                    <Text style={styles.manageTablesBtnText}>Manage Tables & Cabins ➔</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {floors.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Floors Configured</Text>
            <Text style={styles.emptySub}>Add your first restaurant floor to get started.</Text>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, { marginTop: 12 }]} onPress={openAddModal}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>+ Add New Floor</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ---------- Add / Edit Floor Modal ---------- */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View style={[styles.dialogHeaderIcon, { backgroundColor: formColor + '20' }]}>
                <Ionicons name={formIcon} size={22} color={formColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dialogTitle}>{editingFloor ? 'Edit Floor' : 'Add New Floor'}</Text>
                <Text style={styles.dialogSub}>Configure floor details, branding & prefix for tables</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* Floor Name */}
              <Text style={styles.label}>Floor Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ground Floor, 1st Floor, Basement Lounge"
                value={formName}
                onChangeText={setFormName}
              />

              <View style={styles.row}>
                {/* Short Code */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Short Code *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. GF, 1F, BM"
                    maxLength={4}
                    value={formShortCode}
                    onChangeText={setFormShortCode}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Table Prefix */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Table Prefix *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. G, F1, B"
                    maxLength={4}
                    value={formPrefix}
                    onChangeText={setFormPrefix}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Description */}
              <Text style={styles.label}>Description / Blurb</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. Family hall, Couches & Traditional Arabian Majlis"
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
              />

              {/* Color Theme Selector */}
              <Text style={styles.label}>Floor Color Theme</Text>
              <View style={styles.colorPaletteRow}>
                {COLOR_PRESETS.map((cp) => {
                  const selected = formColor.toLowerCase() === cp.value.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cp.value}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: cp.value },
                        selected && styles.colorSwatchSelected,
                      ]}
                      onPress={() => setFormColor(cp.value)}
                    >
                      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Icon Selector */}
              <Text style={styles.label}>Floor Icon</Text>
              <View style={styles.iconPickerRow}>
                {ICON_PRESETS.map((ip) => {
                  const selected = formIcon === ip.icon;
                  return (
                    <TouchableOpacity
                      key={ip.icon}
                      style={[
                        styles.iconChoiceBtn,
                        selected && { borderColor: formColor, backgroundColor: formColor + '18' },
                      ]}
                      onPress={() => setFormIcon(ip.icon)}
                    >
                      <Ionicons name={ip.icon} size={20} color={selected ? formColor : '#636366'} />
                      <Text style={[styles.iconChoiceLabel, selected && { color: formColor, fontWeight: '800' }]}>
                        {ip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Live Preview */}
              <View style={[styles.previewCard, { borderColor: formColor + '40', backgroundColor: formColor + '08' }]}>
                <View style={[styles.floorIconBadge, { backgroundColor: formColor + '20' }]}>
                  <Ionicons name={formIcon} size={20} color={formColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewTitle, { color: formColor }]}>
                    {formName || 'Floor Name Preview'}
                  </Text>
                  <Text style={styles.previewSub}>
                    Badge: {formShortCode.toUpperCase() || 'GF'} • Tables Prefix: {formPrefix.toUpperCase() || 'G'}-XX
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: formColor }]} onPress={handleSaveFloor}>
                <Text style={styles.primaryBtnText}>
                  {editingFloor ? 'Save Floor' : 'Create Floor'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- Delete Confirmation Modal ---------- */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.dialogHeaderIcon, { backgroundColor: '#FDEDEC' }]}>
                <Ionicons name="trash" size={22} color="#D64541" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dialogTitle, { color: '#D64541' }]}>Delete Floor?</Text>
                <Text style={styles.dialogSub}>Permanently remove {deleteTarget?.name}</Text>
              </View>
            </View>

            {(() => {
              if (!deleteTarget) return null;
              const attached = tables.filter((t) => getTableFloor(t).toLowerCase() === deleteTarget.name.toLowerCase());
              return (
                <View style={{ gap: 10, marginBottom: 16 }}>
                  <Text style={styles.deleteWarningText}>
                    Are you sure you want to delete <Text style={{ fontWeight: '800' }}>{deleteTarget.name}</Text>?
                  </Text>
                  {attached.length > 0 ? (
                    <View style={styles.attachedWarningBox}>
                      <Ionicons name="alert-circle" size={18} color="#E65100" />
                      <Text style={styles.attachedWarningText}>
                        This floor has <Text style={{ fontWeight: '800' }}>{attached.length} seating units</Text> attached (tables, couches, or cabins).
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, color: '#636366' }}>
                      No seating units are currently attached to this floor.
                    </Text>
                  )}
                </View>
              );
            })()}

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>

              {(() => {
                const attached = deleteTarget ? tables.filter((t) => getTableFloor(t).toLowerCase() === deleteTarget.name.toLowerCase()) : [];
                if (attached.length > 0) {
                  return (
                    <>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#636366' }]}
                        onPress={() => confirmDeleteFloor(false)}
                      >
                        <Text style={styles.primaryBtnText}>Delete Floor Only</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#D64541' }]}
                        onPress={() => confirmDeleteFloor(true)}
                      >
                        <Text style={styles.primaryBtnText}>Delete All ({attached.length} Units)</Text>
                      </TouchableOpacity>
                    </>
                  );
                }
                return (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#D64541' }]}
                    onPress={() => confirmDeleteFloor(true)}
                  >
                    <Text style={styles.primaryBtnText}>Confirm Delete</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#4a121a',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(213, 169, 67, 0.2)',
  },
  headerMobile: { paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#D5A943' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnGhost: {
    backgroundColor: 'rgba(213, 169, 67, 0.15)',
    borderWidth: 1,
    borderColor: '#D5A943',
  },
  actionBtnPrimary: {
    backgroundColor: '#D5A943',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  content: { padding: 18, paddingBottom: 80, gap: 16 },

  // KPI Row
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFECE6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kpiIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 16, fontWeight: '900', color: '#1C1C1E' },
  kpiLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '700' },

  sectionHeader: { marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1C1C1E' },
  sectionSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  // Floors Grid
  floorsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  floorCard: { padding: 6 },
  floorCardInner: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  floorTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  floorCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  floorIconBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  floorName: { fontSize: 18, fontWeight: '900', color: '#1C1C1E' },
  shortBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  shortBadgeText: { fontSize: 11, fontWeight: '900' },
  floorPrefix: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  cardHeaderButtons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBlurb: { fontSize: 12, color: '#636366', lineHeight: 17 },

  // Zone Counters
  zoneCountersContainer: { flexDirection: 'row', gap: 8 },
  zoneCounterItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    padding: 10,
    gap: 3,
  },
  zoneCounterTitle: { fontSize: 11, fontWeight: '800', color: '#636366' },
  zoneCounterValue: { fontSize: 15, fontWeight: '900', color: '#1C1C1E' },
  zoneCounterSub: { fontSize: 10, color: '#8E8E93', fontWeight: '600' },

  capacityBar: {
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  capacityBarText: { fontSize: 12, color: '#636366' },

  manageTablesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 11,
  },
  manageTablesBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // Empty State
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1C1C1E' },
  emptySub: { fontSize: 13, color: '#8E8E93' },

  // Modal / Dialog
  overlay: { flex: 1, backgroundColor: 'rgba(20,10,12,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 22, padding: 22 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  dialogHeaderIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontSize: 20, fontWeight: '900', color: BRAND_COLOR },
  dialogSub: { fontSize: 12, color: '#8E8E93' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 12, fontWeight: '800', color: '#3A3A3C', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E1DA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#FCFBF9',
  },
  row: { flexDirection: 'row', gap: 10 },

  colorPaletteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },

  iconPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  iconChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E1DA',
    backgroundColor: '#FCFBF9',
  },
  iconChoiceLabel: { fontSize: 12, fontWeight: '700', color: '#636366' },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  previewTitle: { fontSize: 15, fontWeight: '900' },
  previewSub: { fontSize: 11, color: '#636366', marginTop: 2 },

  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ghostBtnText: { color: '#636366', fontWeight: '800', fontSize: 14 },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  deleteWarningText: { fontSize: 14, color: '#1C1C1E', lineHeight: 20 },
  attachedWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF5E7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E67E2240',
  },
  attachedWarningText: { fontSize: 12, color: '#E65100', flex: 1 },
});
