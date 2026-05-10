import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { OwnerButton } from "@/components/OwnerUi";
import { ownerColors } from "@/components/ownerTheme";
import type { OwnerAuthProviderMode } from "@/services/selectAuthSessionProvider";
import type { AuthSignInCredentials } from "@/types/auth";

type LoginScreenProps = {
  authMode?: OwnerAuthProviderMode;
  errorMessage?: string | null;
  isSigningIn?: boolean;
  onSignedIn: (credentials?: AuthSignInCredentials) => void | Promise<void>;
};

export default function LoginScreen({
  authMode = "mock",
  errorMessage,
  isSigningIn = false,
  onSignedIn,
}: LoginScreenProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLoginId, setRememberLoginId] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const isRealMode = authMode === "real";
  const canSubmit = !isSigningIn && (!isRealMode || (loginId.trim().length > 0 && password.length > 0));
  const visibleMessage = errorMessage ?? localMessage;

  const submitLogin = () => {
    if (isRealMode && (!loginId.trim() || !password)) {
      setLocalMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setLocalMessage(null);
    void onSignedIn({
      loginId: loginId.trim(),
      password,
    });
  };

  const showPlaceholderMessage = () => {
    setLocalMessage("앱 안에서는 아직 연결 전입니다. 현재 단계에서는 로그인만 확인합니다.");
  };

  const submitSocialOrPreviewLogin = () => {
    if (isRealMode) {
      showPlaceholderMessage();
      return;
    }

    submitLogin();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={styles.title}>로그인</Text>
        <Text style={styles.description}>
          아이디와 비밀번호를 입력해 주세요{"\n"}
          매장 운영 현황을 안전하게 확인할 수 있습니다.
        </Text>
      </View>

      <OwnerButton label="카카오 1초 로그인/회원가입" onPress={submitSocialOrPreviewLogin} variant="kakao" />

      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSigningIn}
          placeholder="아이디"
          placeholderTextColor="#8f98ac"
          returnKeyType="next"
          style={styles.input}
          textContentType="username"
          value={loginId}
          onChangeText={setLoginId}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSigningIn}
          placeholder="비밀번호"
          placeholderTextColor="#8f98ac"
          returnKeyType="done"
          secureTextEntry
          style={styles.input}
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submitLogin}
        />
      </View>

      <Pressable style={styles.rememberRow} onPress={() => setRememberLoginId((current) => !current)}>
        <View style={[styles.checkbox, rememberLoginId && styles.checkboxOn]}>
          {rememberLoginId ? <Text style={styles.checkText}>✓</Text> : null}
        </View>
        <Text style={styles.rememberText}>아이디 저장</Text>
      </Pressable>

      {visibleMessage ? <Text style={styles.message}>{visibleMessage}</Text> : null}

      <OwnerButton
        label={isSigningIn ? "로그인 확인 중" : isRealMode ? "로그인" : "로그인 미리보기"}
        onPress={submitLogin}
        disabled={!canSubmit}
      />

      <View style={styles.helperLinks}>
        <Pressable onPress={showPlaceholderMessage}>
          <Text style={styles.helperText}>아이디 찾기</Text>
        </Pressable>
        <Text style={styles.helperDivider}>|</Text>
        <Pressable onPress={showPlaceholderMessage}>
          <Text style={styles.helperText}>비밀번호 찾기</Text>
        </Pressable>
        <Text style={styles.helperDivider}>|</Text>
        <Pressable onPress={showPlaceholderMessage}>
          <Text style={styles.helperText}>회원가입</Text>
        </Pressable>
      </View>

      <View style={styles.socialStack}>
        <OwnerButton label="네이버 계정으로 계속하기" onPress={submitSocialOrPreviewLogin} variant="naver" />
        <OwnerButton label="Google 계정으로 계속하기" onPress={submitSocialOrPreviewLogin} variant="ghost" />
      </View>

      <View style={styles.devCard}>
        <Text style={styles.devTitle}>현재 인증 모드: {isRealMode ? "실제 로그인" : "미리보기"}</Text>
        <Text style={styles.devDescription}>
          기본 실행은 mock 로그인을 유지합니다. 실제 로그인은 명시적으로 real auth mode를 켰을 때만 사용합니다.
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
    marginBottom: 16,
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
  message: {
    marginBottom: 12,
    color: "#d34b4b",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
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
