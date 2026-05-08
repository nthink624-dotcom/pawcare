import { Pressable, StyleSheet, Text, View } from "react-native";

import { Chip, OwnerButton, OwnerCard, OwnerScreen, SearchBox, TagList } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { CustomerSummaryViewModel } from "@/viewModels/ownerViewModels";

type CustomerListScreenProps = {
  customers: CustomerSummaryViewModel[];
  onOpenCustomer: (customerId: string) => void;
};

export default function CustomerListScreen({ customers, onOpenCustomer }: CustomerListScreenProps) {
  return (
    <OwnerScreen title="고객관리" subtitle="고객 검색, 태그 필터, 상세 화면을 모바일에서 빠르게 확인합니다." action={<OwnerButton label="고객추가" variant="secondary" />}>
      <OwnerCard>
        <SearchBox placeholder="보호자명, 연락처, 반려동물 이름 검색" />
        <View style={styles.toolbar}>
          <Chip label="전체" active />
          <Chip label="정기 고객" tone="soft" />
          <Chip label="재방문 임박" tone="soft" />
          <Chip label="상담 필요" tone="soft" />
        </View>
        <View style={styles.toolbar}>
          <OwnerButton label="고객 삭제" variant="ghost" />
          <OwnerButton label="최신 방문순" variant="ghost" />
        </View>
      </OwnerCard>

      {customers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} onPress={() => onOpenCustomer(customer.id)} />
      ))}
    </OwnerScreen>
  );
}

function CustomerCard({ customer, onPress }: { customer: CustomerSummaryViewModel; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <OwnerCard>
        <View style={styles.customerHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.avatarSeed}</Text>
          </View>
          <View style={styles.customerBody}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.customerMeta}>
              {customer.phone} · {customer.petNames.join(", ")}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <TagList tags={customer.tags} />
        <View style={styles.summaryGrid}>
          <Summary label="최근 방문" value={customer.latestVisitLabel} />
          <Summary label="다음 예약" value={customer.nextBookingLabel} />
        </View>
        <Text style={styles.alertText}>{customer.alertLabel}</Text>
      </OwnerCard>
    </Pressable>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dfeae5",
    backgroundColor: "#f6fbf9",
  },
  avatarText: {
    color: ownerColors.accent,
    fontSize: 18,
    fontWeight: "900",
  },
  customerBody: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    color: ownerColors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  customerMeta: {
    color: ownerColors.muted,
    fontSize: 13,
  },
  chevron: {
    color: ownerColors.faint,
    fontSize: 26,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    padding: 10,
    gap: 4,
  },
  summaryLabel: {
    color: ownerColors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: ownerColors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  alertText: {
    color: ownerColors.muted,
    fontSize: 13,
  },
});
