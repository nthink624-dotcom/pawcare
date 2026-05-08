import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { OwnerButton } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";

type LoginScreenProps = {
  onSignedIn: () => void;
};

export default function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [rememberLoginId, setRememberLoginId] = useState(false);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}>
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.description}>
          아이디와 비밀번호 입력이 귀찮으신가요?{"\n"}1초 회원가입으로 입력 없이 간편하게 로그인 하세요.
        </Text>
      </View>

      <OwnerButton label="카카오 1초 로그인/회원가입" onPress={onSignedIn} variant="kakao" />

      <View style={styles.form}>
        <TextInput editable={false} placeholder="아이디" placeholderTextColor="#8f98ac" style={styles.input} />
        <TextInput editable={false} placeholder="비밀번호" placeholderTextColor="#8f98ac" secureTextEntry style={styles.input} />
      </View>

      <Pressable style={styles.rememberRow} onPress={() => setRememberLoginId((current) => !current)}>
        <View style={[styles.checkbox, rememberLoginId && styles.checkboxOn]}>{rememberLoginId ? <Text style={styles.checkText}>✓</Text> : null}</View>
        <Text style={styles.rememberText}>아이디 저장</Text>
      </Pressable>

      <OwnerButton label="로그인 미리보기" onPress={onSignedIn} />

      <View style={styles.helperLinks}>
        <Text style={styles.helperText}>아이디 찾기</Text>
        <Text style={styles.helperDivider}>|</Text>
        <Text style={styles.helperText}>비밀번호 찾기</Text>
        <Text style={styles.helperDivider}>|</Text>
        <Text style={styles.helperText}>회원가입</Text>
      </View>

      <View style={styles.socialStack}>
        <OwnerButton label="네이버 계정으로 계속하기" onPress={onSignedIn} variant="naver" />
        <OwnerButton label="Google 계정으로 계속하기" onPress={onSignedIn} variant="ghost" />
      </View>

      <View style={styles.devCard}>
        <Text style={styles.devTitle}>개발용 테스트 계정</Text>
        <Text style={styles.devDescription}>
          현재 앱은 실제 인증을 연결하지 않았습니다. 버튼은 기존 웹 로그인 흐름을 미리 보는 placeholder입니다.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 36,
  },
  heading: {
    alignItems: "center",
    gap: 14,
  },
  title: {
    color: "#111111",
    fontSize: 30,
    fontWeight: "900",
  },
  description: {
    color: "#7b746b",
    fontSize: 15,
    lineHeight: 25,
    textAlign: "center",
  },
  form: {
    gap: 12,
    marginTop: 24,
  },
  input: {
    height: 50,
    backgroundColor: ownerColors.input,
    paddingHorizontal: 16,
    color: "#111111",
    fontSize: 18,
    fontWeight: "700",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 22,
  },
  checkbox: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#111111",
  },
  checkboxOn: {
    backgroundColor: ownerColors.accent,
    borderColor: ownerColors.accent,
  },
  checkText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  rememberText: {
    color: "#111111",
    fontSize: 15,
  },
  helperLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  helperText: {
    color: "#8b847b",
    fontSize: 15,
  },
  helperDivider: {
    color: "#c0b9b1",
    fontSize: 15,
  },
  socialStack: {
    gap: 10,
    marginTop: 26,
  },
  devCard: {
    marginTop: 24,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dfe7e2",
    backgroundColor: "#f6fbf9",
    padding: 14,
    gap: 8,
  },
  devTitle: {
    color: ownerColors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  devDescription: {
    color: "#5f6c66",
    fontSize: 13,
    lineHeight: 20,
  },
});
