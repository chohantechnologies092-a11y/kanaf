import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView, 
  useWindowDimensions, 
  Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

export type DrawerItem = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type RoleDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  items: DrawerItem[];
  roleName: string;
};

const BRAND = {
  burgundy: '#4a121a',
  gold: '#D5A943',
  ink: '#1A1A1A',
  muted: '#7A7A7A',
  border: '#E8E1D5',
  cardBg: '#FFFFFF',
};

export default function RoleDrawer({ isOpen, onClose, items, roleName }: RoleDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const drawerWidth = isMobile ? width * 0.8 : 300;

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.drawer, { width: drawerWidth }]}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>{roleName} Menu</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={BRAND.burgundy} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {items.map((item, index) => {
              const isActive = pathname === item.route;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, isActive && styles.menuItemActive]}
                  onPress={() => {
                    onClose();
                    router.push(item.route as any);
                  }}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={20} 
                    color={isActive ? BRAND.burgundy : BRAND.muted} 
                    style={styles.menuIcon} 
                  />
                  <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    backgroundColor: '#FDFBF7',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.burgundy,
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    flex: 1,
    paddingTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: 'rgba(213, 169, 67, 0.1)',
    borderLeftColor: BRAND.gold,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.ink,
  },
  menuLabelActive: {
    color: BRAND.burgundy,
    fontWeight: '800',
  },
});
