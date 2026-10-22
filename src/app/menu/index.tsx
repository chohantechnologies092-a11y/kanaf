import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRestaurantStore } from '../../store/restaurantStore';
import SultanLogo from '../../components/SultanLogo';
import UniversalPortalNav from '../../components/UniversalPortalNav';

export default function CustomerMenuScreen() {
  const router = useRouter();
  const menuItems = useRestaurantStore(state => state.menuItems);
  const categories = useRestaurantStore(state => state.categories);
  const [activeCat, setActiveCat] = useState('All');
  
  // Adding high quality fallback images for visual appeal
  const getFallbackImage = (category: string) => {
    switch (category) {
      case 'Coffee & Espresso': return 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&q=80';
      case 'Bakery & Croissants': return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80';
      case 'Cakes & Patisserie': return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80';
      case 'Kunafa & Sweets': return 'https://images.unsplash.com/photo-1608836561226-d621b10a26e8?w=500&q=80';
      case 'Cafe Brunch & Paninis': return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80';
      case 'Beverages & Shakes': return 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&q=80';
      case 'Deals & Combos': return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80';
      default: return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80';
    }
  };

  const filteredItems = activeCat === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === activeCat);

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#440112" />
      <UniversalPortalNav
        portalName="Kanaf Digital Menu"
        portalRole="Customer Menu"
        showTabs={false}
      />
      <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>
        
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1000&q=80' }} 
            style={styles.heroImage} 
          />
          <View style={styles.heroOverlay}>
            <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.heroTextContainer}>
              <SultanLogo size="lg" width={60} height={55} style={{ marginBottom: 4 }} />
              <Text style={styles.heroTitle}>Kanaf Cafe & Bakery</Text>
              <Text style={styles.heroSubtitle}>Artisan Bakes & Specialty Coffee</Text>
            </View>
          </View>
        </View>

        {/* Sticky Categories Bar */}
        <View style={styles.categoriesWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {['All', ...categories].map(cat => (
              <TouchableOpacity 
                key={cat}
                style={[styles.catBadge, activeCat === cat && styles.catBadgeActive]}
                onPress={() => setActiveCat(cat)}
              >
                <Text style={[styles.catText, activeCat === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>{activeCat} Menu</Text>
          
          <View style={styles.grid}>
            {filteredItems.map(item => (
              <View key={item.id} style={styles.menuCard}>
                <Image 
                  source={{ uri: item.imageUri || getFallbackImage(item.category) }} 
                  style={styles.itemImage} 
                />
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      {item.badge && (
                        <View style={styles.badgePill}>
                          <Text style={styles.badgePillText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemPrice}>Rs. {item.price.toFixed(0)}</Text>
                      {item.dealOriginalPrice && item.dealOriginalPrice > item.price && (
                        <Text style={styles.dealSavingsText}>Save Rs. {(item.dealOriginalPrice - item.price).toFixed(0)}</Text>
                      )}
                    </View>
                  </View>

                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {item.description || `Delicious ${item.name.toLowerCase()} prepared fresh by royal Sultan chefs.`}
                  </Text>
                  
                  {item.isDeal && item.dealItems && item.dealItems.length > 0 && (
                    <Text style={styles.comboIncludesText} numberOfLines={1}>
                      Includes: {item.dealItems.map(d => `${d.qty}x ${d.name}`).join(' • ')}
                    </Text>
                  )}

                  <TouchableOpacity style={styles.addBtn}>
                    <Ionicons name="add" size={20} color="#D5A943" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#4a121a',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  heroSection: {
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(68, 1, 18, 0.70)', // Kanaf Wine Burgundy Overlay
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFE0CB', // Kanaf Cream
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 1,
  },
  categoriesWrapper: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }
    }),
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  catBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  catBadgeActive: {
    backgroundColor: '#440112',
    borderColor: '#440112',
  },
  catText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  catTextActive: {
    color: '#FFE0CB',
  },
  menuContainer: {
    padding: 20,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 60,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 20,
  },
  menuCard: {
    width: Platform.OS === 'web' ? '48%' : '100%',
    minWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  itemImage: {
    width: 120,
    height: 120,
  },
  itemContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#440112',
  },
  itemDesc: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 8,
  },
  addBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fffdf5',
    borderWidth: 1,
    borderColor: '#D5A943',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    backgroundColor: '#FFF9F0',
    borderColor: '#D5A943',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  badgePillText: {
    color: '#8c6b1b',
    fontSize: 10,
    fontWeight: '700',
  },
  dealSavingsText: {
    color: '#6A1B9A',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  comboIncludesText: {
    fontSize: 11,
    color: '#6A1B9A',
    backgroundColor: '#FAF5FF',
    padding: 4,
    borderRadius: 4,
    marginVertical: 4,
  }
});
