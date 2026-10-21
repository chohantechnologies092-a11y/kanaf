import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DropdownOption<T = string> {
  label: string;
  value: T;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  sublabel?: string;
}

export interface RoyalDropdownProps<T = string> {
  label?: string;
  placeholder?: string;
  options: readonly (DropdownOption<T> | string)[];
  value: T;
  onSelect: (val: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  style?: ViewStyle;
  triggerStyle?: ViewStyle;
  menuStyle?: ViewStyle;
  labelStyle?: TextStyle;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  maxHeight?: number;
  required?: boolean;
  prefix?: string;
}

export default function RoyalDropdown<T = string>({
  label,
  placeholder = 'Select an option...',
  options,
  value,
  onSelect,
  searchable,
  searchPlaceholder = 'Search...',
  style,
  triggerStyle,
  menuStyle,
  labelStyle,
  icon,
  disabled = false,
  maxHeight = 240,
  required = false,
  prefix,
}: RoyalDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize options to DropdownOption
  const normalizedOptions: DropdownOption<T>[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt as unknown as T };
      }
      return opt;
    });
  }, [options]);

  // Current selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value) || null;
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  const shouldShowSearch = searchable !== undefined ? searchable : normalizedOptions.length > 6;

  const handleSelect = (val: T) => {
    onSelect(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, labelStyle]}>
            {label}
            {required ? <Text style={styles.requiredStar}> *</Text> : null}
          </Text>
        </View>
      ) : null}

      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.trigger,
          isOpen && styles.triggerActive,
          disabled && styles.triggerDisabled,
          triggerStyle,
        ]}
        onPress={() => !disabled && setIsOpen(!isOpen)}
        activeOpacity={0.8}
        {...(Platform.OS === 'web' ? ({ className: 'interactive-btn' } as any) : {})}
      >
        <View style={styles.triggerLeft}>
          {icon ? (
            <View style={styles.iconBox}>
              <Ionicons name={icon} size={15} color="#52171B" />
            </View>
          ) : null}

          {prefix ? <Text style={styles.prefixText}>{prefix}</Text> : null}

          <Text
            style={[
              styles.triggerText,
              !selectedOption && styles.triggerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>

          {selectedOption?.badge ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>{selectedOption.badge}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chevronBox}>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={isOpen ? '#52171B' : '#64748B'}
          />
        </View>
      </TouchableOpacity>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <View style={[styles.menu, menuStyle]}>
          {shouldShowSearch && (
            <View style={styles.searchRow}>
              <Ionicons name="search" size={14} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView
            style={[styles.scrollList, { maxHeight }]}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {filteredOptions.length === 0 ? (
              <View style={styles.emptyRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#94A3B8" />
                <Text style={styles.emptyText}>No options found</Text>
              </View>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;

                return (
                  <TouchableOpacity
                    key={`${opt.value}-${idx}`}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    onPress={() => handleSelect(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      {opt.icon ? (
                        <Ionicons
                          name={opt.icon}
                          size={15}
                          color={isSelected ? '#52171B' : '#64748B'}
                          style={{ marginRight: 8 }}
                        />
                      ) : null}

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                        {opt.sublabel ? (
                          <Text style={styles.optionSublabel} numberOfLines={1}>
                            {opt.sublabel}
                          </Text>
                        ) : null}
                      </View>

                      {opt.badge ? (
                        <View style={styles.optionBadge}>
                          <Text style={styles.optionBadgeText}>{opt.badge}</Text>
                        </View>
                      ) : null}
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  requiredStar: {
    color: '#E11D48',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  triggerActive: {
    borderColor: '#B48214',
    shadowColor: '#B48214',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  triggerDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.6,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(82, 23, 27, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  triggerPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  selectedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  chevronBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(180, 130, 20, 0.35)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 2,
  },
  scrollList: {
    paddingVertical: 4,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  optionItemSelected: {
    backgroundColor: '#FEF3C7',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  optionLabelSelected: {
    color: '#52171B',
    fontWeight: '800',
  },
  optionSublabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  optionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  optionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
});
