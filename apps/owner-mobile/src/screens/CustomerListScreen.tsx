import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ownerColors } from "@/components/ownerTheme";
import type { CustomerSummaryViewModel } from "@/viewModels/ownerViewModels";

type CustomerListScreenProps = {
  customers: CustomerSummaryViewModel[];
  onOpenCustomer: (customerId: string) => void;
};

export default function CustomerListScreen({ customers, onOpenCustomer }: CustomerListScreenProps) {
  const [query, setQuery] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredCustomers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return customers;

    return customers.filter((customer) => {
      const haystack = [customer.name, customer.phone, customer.petNames.join(" ")].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [customers, query]);

  const allVisibleSelected = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedIds.includes(customer.id));

  const toggleSelected = (customerId: string) => {
    setSelectedIds((current) => (current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId]));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredCustomers.some((customer) => customer.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...filteredCustomers.map((customer) => customer.id)])));
  };

  const closeDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds([]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>고객관리</Text>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>고객추가</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="보호자명, 연락처, 반려동물 이름 검색"
          placeholderTextColor="#8f887f"
          style={styles.searchBox}
        />
        <Pressable
          style={[styles.deleteModeButton, deleteMode && styles.deleteModeButtonActive]}
          onPress={deleteMode ? closeDeleteMode : () => setDeleteMode(true)}
          accessibilityLabel={deleteMode ? "고객 삭제 선택 모드 닫기" : "고객 삭제 선택 모드 열기"}
        >
          <Ionicons name={deleteMode ? "close" : "trash-outline"} size={22} color={deleteMode ? ownerColors.danger : "#6f6a63"} />
        </Pressable>
      </View>

      {deleteMode ? (
        <View style={styles.deleteToolbar}>
          <Pressable style={styles.selectAllButton} onPress={toggleAllVisible}>
            <Text style={styles.selectAllText}>{allVisibleSelected ? "전체 해제" : "전체 선택"}</Text>
          </Pressable>
          <Pressable style={[styles.deleteButton, selectedIds.length === 0 && styles.deleteButtonDisabled]}>
            <Text style={styles.deleteButtonText}>선택한 고객 삭제 ({selectedIds.length})</Text>
          </Pressable>
        </View>
      ) : null}

      {filteredCustomers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>검색된 고객이 없어요</Text>
        </View>
      ) : null}

      {filteredCustomers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          deleteMode={deleteMode}
          selected={selectedIds.includes(customer.id)}
          onSelect={() => toggleSelected(customer.id)}
          onPress={() => onOpenCustomer(customer.id)}
        />
      ))}
    </ScrollView>
  );
}

function CustomerCard({
  customer,
  deleteMode,
  selected,
  onSelect,
  onPress,
}: {
  customer: CustomerSummaryViewModel;
  deleteMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onPress: () => void;
}) {
  const petNames = customer.petNames.join(", ") || "등록된 반려동물 없음";

  return (
    <Pressable onPress={deleteMode ? onSelect : onPress}>
      <View style={[styles.customerCard, selected && styles.customerCardSelected]}>
        <View style={styles.customerHeader}>
          {deleteMode ? (
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
              {selected ? <Ionicons name="checkmark" size={15} color="#ffffff" /> : null}
            </View>
          ) : null}
          <View style={styles.customerSummaryLine}>
            <Text style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
            <Text style={styles.customerDivider}>·</Text>
            <Text style={styles.customerPhone} numberOfLines={1}>{customer.phone}</Text>
            <Text style={styles.customerDivider}>·</Text>
            <Text style={styles.petNames} numberOfLines={1}>{petNames}</Text>
          </View>
          {!deleteMode ? (
            <View style={styles.chevronCircle}>
              <Ionicons name="chevron-forward" size={18} color="#9b948c" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ownerColors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 10,
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ownerColors.border,
    paddingBottom: 16,
    marginBottom: 10,
  },
  title: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "800",
  },
  addButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: ownerColors.accent,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    color: ownerColors.text,
    fontSize: 16,
  },
  deleteModeButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  deleteModeButtonActive: {
    borderColor: "#d8c7bb",
    backgroundColor: ownerColors.dangerSoft,
  },
  deleteToolbar: {
    gap: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ead6cc",
    backgroundColor: ownerColors.dangerSoft,
    padding: 10,
  },
  selectAllButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dfcabc",
    backgroundColor: "#fffdfa",
  },
  selectAllText: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  deleteButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: ownerColors.danger,
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBox: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  emptyText: {
    color: ownerColors.muted,
    fontSize: 15,
  },
  customerCard: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  customerCardSelected: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accentSoft,
  },
  customerHeader: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: "#ffffff",
  },
  checkboxSelected: {
    borderColor: ownerColors.accent,
    backgroundColor: ownerColors.accent,
  },
  customerSummaryLine: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  customerName: {
    flexShrink: 0,
    maxWidth: 76,
    color: "#111111",
    fontSize: 15,
    fontWeight: "800",
  },
  customerDivider: {
    color: "#d6cec4",
    fontSize: 13,
  },
  customerPhone: {
    flexShrink: 0,
    color: "#69635d",
    fontSize: 13,
    lineHeight: 18,
  },
  petNames: {
    flex: 1,
    minWidth: 0,
    color: "#5e5a56",
    fontSize: 13,
    lineHeight: 18,
  },
  chevronCircle: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ebe3da",
    backgroundColor: "#fffdfa",
  },
});
