import { StyleSheet, Text, View } from "react-native";

import { InfoRow, OwnerButton, OwnerCard, OwnerScreen, TagList } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { CustomerDetailViewModel } from "@/viewModels/ownerViewModels";

type CustomerDetailScreenProps = {
  customer: CustomerDetailViewModel | null;
  onBack: () => void;
};

export default function CustomerDetailScreen({ customer, onBack }: CustomerDetailScreenProps) {
  if (!customer) {
    return (
      <OwnerScreen title="고객 상세" subtitle="고객 정보를 찾을 수 없습니다." action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
        <OwnerCard title="고객 없음" description="선택한 고객이 mock 데이터에 없습니다." />
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen title="고객 상세" subtitle={`${customer.phone} · ${customer.petNames.join(", ")}`} action={<OwnerButton label="목록" onPress={onBack} variant="ghost" />}>
      <OwnerCard tone="accent">
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.avatarSeed}</Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.meta}>{customer.alertLabel}</Text>
          </View>
        </View>
        <TagList tags={customer.tags} />
      </OwnerCard>

      <OwnerCard title="기본 정보">
        <InfoRow label="보호자" value={`${customer.name} / ${customer.phone}`} />
        <InfoRow label="최근 방문" value={customer.latestVisitLabel} />
        <InfoRow label="다음 예약" value={customer.nextBookingLabel} />
      </OwnerCard>

      <OwnerCard title="반려동물">
        {customer.pets.map((pet) => (
          <View key={pet.id} style={styles.petRow}>
            <View style={styles.petAvatar}>
              <Text style={styles.petAvatarText}>{pet.avatarSeed}</Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.meta}>
                {pet.breed} · {pet.groomingCycleWeeks}주 주기
              </Text>
            </View>
          </View>
        ))}
      </OwnerCard>

      <OwnerCard title="고객 메모" description={customer.alertLabel}>
        <Text style={styles.memo}>{customer.memo}</Text>
      </OwnerCard>

      <OwnerCard title="빠른 예약">
        <Text style={styles.meta}>전화 응대 중에도 이 고객 기준으로 바로 예약을 붙일 수 있는 액션입니다.</Text>
        <View style={styles.actionGrid}>
          <OwnerButton label="빠른 예약 추가" variant="secondary" />
          <OwnerButton label="알림 상태 수정" variant="ghost" />
        </View>
      </OwnerCard>

      <OwnerCard title="예약 내역">
        {customer.appointments.map((reservation) => (
          <View key={reservation.id} style={styles.historyRow}>
            <Text style={styles.historyTime}>{reservation.time}</Text>
            <View style={styles.profileBody}>
              <Text style={styles.petName}>{reservation.petName}</Text>
              <Text style={styles.meta}>
                {reservation.serviceName} · {reservation.statusLabel}
              </Text>
            </View>
          </View>
        ))}
      </OwnerCard>

      <OwnerCard title="미용 기록">
        {customer.groomingRecords.map((record) => (
          <View key={record.id} style={styles.historyRow}>
            <Text style={styles.historyTime}>{record.groomedAt}</Text>
            <View style={styles.profileBody}>
              <Text style={styles.petName}>{record.petName}</Text>
              <Text style={styles.meta}>
                {record.serviceName} · {record.pricePaidLabel}
              </Text>
            </View>
          </View>
        ))}
      </OwnerCard>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: ownerColors.accent,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  profileBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: ownerColors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  meta: {
    color: ownerColors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  petRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    padding: 12,
  },
  petAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: ownerColors.accentSoft,
  },
  petAvatarText: {
    color: ownerColors.accent,
    fontSize: 17,
    fontWeight: "900",
  },
  petName: {
    color: ownerColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  memo: {
    color: ownerColors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surfaceSoft,
    padding: 12,
  },
  historyTime: {
    minWidth: 46,
    color: ownerColors.text,
    fontSize: 16,
    fontWeight: "800",
  },
});
