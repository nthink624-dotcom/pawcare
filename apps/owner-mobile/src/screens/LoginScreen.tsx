import { useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ownerColors } from "@/components/ownerTheme";
import type { OwnerAuthProviderMode } from "@/services/selectAuthSessionProvider";
import type { AuthSignInCredentials } from "@/types/auth";

type LoginScreenProps = {
  authMode?: OwnerAuthProviderMode;
  errorMessage?: string | null;
  isSigningIn?: boolean;
  onSignedIn: (credentials?: AuthSignInCredentials) => void | Promise<void>;
};

const socialIconSources = {
  kakao: require("../../assets/auth/kakao-symbol.png") as ImageSourcePropType,
  naver: require("../../assets/auth/naver-symbol.png") as ImageSourcePropType,
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
  const [showPassword, setShowPassword] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const canSubmit = !isSigningIn && Boolean(loginId.trim()) && Boolean(password);
  const visibleMessage = errorMessage ?? localMessage;

  const submitLogin = () => {
    if (!loginId.trim() || !password) {
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
    setLocalMessage("소셜 로그인 처리 중 문제가 발생했어요. 다시 시도해 주세요.");
  };

  const submitSocialOrPreviewLogin = () => {
    showPlaceholderMessage();
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
          아이디와 비밀번호 입력이 귀찮으신가요?{"\n"}
          1초 회원가입으로 입력 없이 간편하게 로그인 하세요.
        </Text>
      </View>

      <AuthButton
        label="카카오 1초 로그인/회원가입"
        onPress={submitSocialOrPreviewLogin}
        disabled={isSigningIn}
        tone="kakao"
        style={styles.kakaoButton}
      />

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
        <View style={styles.passwordField}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSigningIn}
            placeholder="비밀번호"
            placeholderTextColor="#8f98ac"
            returnKeyType="done"
            secureTextEntry={!showPassword}
            style={[styles.input, styles.passwordInput]}
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submitLogin}
          />
          <Pressable
            accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            style={styles.passwordToggle}
            onPress={() => setShowPassword((current) => !current)}
          >
            <Text style={styles.passwordToggleText}>{showPassword ? "숨김" : "보기"}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.rememberRow} onPress={() => setRememberLoginId((current) => !current)}>
        <View style={[styles.checkbox, rememberLoginId && styles.checkboxOn]}>
          {rememberLoginId ? <Text style={styles.checkText}>✓</Text> : null}
        </View>
        <Text style={styles.rememberText}>아이디 저장</Text>
      </Pressable>

      {visibleMessage ? <Text style={styles.message}>{visibleMessage}</Text> : null}

      <AuthButton
        label={isSigningIn ? "로그인 중..." : "로그인"}
        onPress={submitLogin}
        disabled={!canSubmit}
        tone="primary"
        style={styles.loginButton}
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
        <AuthButton label="네이버 계정으로 계속하기" onPress={submitSocialOrPreviewLogin} disabled={isSigningIn} tone="naver" />
        <AuthButton label="Google 계정으로 계속하기" onPress={submitSocialOrPreviewLogin} disabled={isSigningIn} tone="google" />
      </View>
    </ScrollView>
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone: "primary" | "kakao" | "naver" | "google";
  style?: object;
};

function AuthButton({ label, onPress, disabled = false, tone, style }: AuthButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[styles.authButton, buttonToneStyles[tone], disabled && styles.authButtonDisabled, style]}
    >
      {tone !== "primary" ? (
        <View style={styles.socialSymbol}>
          {tone === "google" ? (
            <GoogleSymbol />
          ) : (
            <Image source={socialIconSources[tone]} style={styles.socialSymbolImage} resizeMode="contain" />
          )}
        </View>
      ) : null}
      <Text style={[styles.authButtonText, buttonTextToneStyles[tone]]}>{label}</Text>
    </Pressable>
  );
}

function GoogleSymbol() {
  return (
    <View style={styles.googleSymbol}>
      <Text style={styles.googleBlue}>G</Text>
    </View>
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
    lineHeight: 28,
    textAlign: "center",
  },
  kakaoButton: {
    marginTop: 32,
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
    fontWeight: "600",
  },
  passwordField: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 58,
  },
  passwordToggle: {
    position: "absolute",
    top: 7,
    right: 8,
    height: 36,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  passwordToggleText: {
    color: "#6f665d",
    fontSize: 13,
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
    marginTop: 12,
    color: "#d34b4b",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 24,
  },
  loginButton: {
    marginTop: 24,
  },
  helperLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 28,
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
    marginTop: 28,
  },
  authButton: {
    position: "relative",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 56,
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  socialSymbol: {
    position: "absolute",
    left: 17,
    top: 13,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  socialSymbolImage: {
    width: 22,
    height: 22,
  },
  googleSymbol: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  googleBlue: {
    color: "#4285f4",
    fontSize: 18,
    fontWeight: "900",
  },
});

const buttonToneStyles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: 6,
    borderColor: "#0e8c6d",
    backgroundColor: "#0e8c6d",
  },
  kakao: {
    borderColor: "#fee500",
    backgroundColor: "#fee500",
  },
  naver: {
    borderColor: "#05ac4f",
    backgroundColor: "#05ac4f",
  },
  google: {
    borderColor: "#747775",
    backgroundColor: "#ffffff",
  },
});

const buttonTextToneStyles = StyleSheet.create({
  primary: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  kakao: {
    color: "#191600",
  },
  naver: {
    color: "#ffffff",
  },
  google: {
    color: "#1f1f1f",
  },
});
