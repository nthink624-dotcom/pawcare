import { Pressable, StyleSheet, Text, View } from "react-native";

import { OwnerButton, OwnerScreen, SearchBox } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { CustomerSummaryViewModel } from "@/viewModels/ownerViewModels";

type CustomerListScreenProps = {
  customers: CustomerSummaryViewModel[];
  onOpenCustomer: (customerId: string) => void;
};

export default function CustomerListScreen({ customers, onOpenCustomer }: CustomerListScreenProps) {
  return (
    <OwnerScreen title="고객관리" action={<OwnerButton label="고객추가" variant="secondary" />}>
      <View style={styles.searchRow}>
        <View style={styles.searchBoxWrap}>
          <SearchBox placeholder="보호자명, 연락처, 반려동물 이름 검색" />
        </View>
        <Pressable style={styles.deleteModeButton} accessibilityLabel="고객 삭제 선택 모드 열기">
          <Text style={styles.deleteModeIcon}>×</Text>
        </Pressable>
      </View>

      {customers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} onPress={() => onOpenCustomer(customer.id)} />
      ))}
    </OwnerScreen>
  );
}

function CustomerCard({ customer, onPress }: { customer: CustomerSummaryViewModel; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View style={styles.customerBody}>
            <Text style={styles.customerName}>{customer.name}</Text>
          </View>
          <View style={styles.chevronCircle}>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
        <View style={styles.customerMetaBlock}>
          <Text style={styles.customerMeta}>{customer.phone}</Text>
          <Text style={styles.petNames}>{customer.petNames.join(", ") || "등록된 반려동물 없음"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBoxWrap: {
    flex: 1,
  },
  deleteModeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
  },
  deleteModeIcon: {
    color: ownerColors.muted,
    fontSize: 26,
    fontWeight: "300",
    transform: [{ rotate: "45deg" }],
  },
  customerCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  customerBody: {
    flex: 1,
  },
  customerName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  customerMetaBlock: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee7de",
    paddingTop: 4,
  },
  customerMeta: {
    color: ownerColors.muted,
    fontSize: 12.5,
    lineHeight: 19,
  },
  petNames: {
    color: "#5e5a56",
    fontSize: 12.5,
    lineHeight: 19,
  },
  chevronCircle: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ebe3da",
    backgroundColor: ownerColors.surfaceSoft,
  },
  chevron: {
    color: ownerColors.muted,
    fontSize: 20,
    lineHeight: 22,
  },
});
