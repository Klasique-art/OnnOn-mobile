import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type } from "@/src/theme/colors";
import { MockProfile, mockProfile } from "@/src/data/mockProfile";

export default function ProfileScreen() {
  const router = useRouter();
  const [savedProfile, setSavedProfile] = useState<MockProfile>(mockProfile);
  const [draft, setDraft] = useState<MockProfile>(mockProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const initials = useMemo(() => {
    const parts = draft.displayName.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [draft.displayName]);

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedProfile),
    [draft, savedProfile]
  );

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to choose an avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setDraft((prev) => ({ ...prev, avatarUri: result.assets[0].uri }));
  };

  const removeAvatar = () => {
    setDraft((prev) => ({ ...prev, avatarUri: null }));
  };

  const saveProfile = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSavedProfile(draft);
    setIsSaving(false);
    setIsEditing(false);
    Alert.alert("Saved", "Profile changes stored in simulation mode.");
  };

  const resetChanges = () => {
    setDraft(savedProfile);
  };

  const cancelEditing = () => {
    setDraft(savedProfile);
    setIsEditing(false);
  };

  const logout = () => {
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior="padding"
        keyboardVerticalOffset={76}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.bgOrbTop} />
          <View style={styles.bgOrbBottom} />

          <View style={styles.header}>
            <Text style={styles.kicker}>Profile</Text>
            <Text style={styles.title}>Personal settings</Text>
            <Text style={styles.subtitle}>
              Edit identity, meeting defaults, and account preferences.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatarShell}>
                {draft.avatarUri ? (
                  <Image source={{ uri: draft.avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>

              <View style={styles.profileMeta}>
                <Text style={styles.name}>{draft.displayName || "Unnamed User"}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{draft.role}</Text>
                  </View>
                  {draft.isVerified ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.inlineActions}>
              {isEditing ? (
                <>
                  <Pressable onPress={pickAvatar} style={styles.inlineActionBtn}>
                    <Text style={styles.inlineActionText}>Change photo</Text>
                  </Pressable>
                  <Pressable onPress={removeAvatar} style={styles.inlineActionBtn}>
                    <Text style={styles.inlineActionText}>Remove</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => setIsEditing(true)}
                  style={[styles.inlineActionBtn, styles.editCtaBtn]}
                >
                  <Text style={styles.inlineActionText}>Edit profile</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Info</Text>

            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              value={draft.displayName}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, displayName: value }))}
              style={[styles.input, !isEditing && styles.inputDisabled]}
              placeholder="Display name"
              placeholderTextColor={colors.textMuted}
              editable={isEditing}
            />

            <Text style={styles.fieldLabel}>Role</Text>
            <TextInput
              value={draft.role}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, role: value }))}
              style={[styles.input, !isEditing && styles.inputDisabled]}
              placeholder="Role"
              placeholderTextColor={colors.textMuted}
              editable={isEditing}
            />

            <Text style={styles.fieldLabel}>Email (read-only)</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{draft.email}</Text>
            </View>

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              value={draft.bio}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, bio: value }))}
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              multiline
              placeholder="Short bio"
              placeholderTextColor={colors.textMuted}
              editable={isEditing}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Meeting Defaults</Text>
            <PreferenceRow
              label="Join with microphone"
              value={draft.preferences.audioDefault}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, audioDefault: value },
                }))
              }
            />
            <PreferenceRow
              label="Join with camera"
              value={draft.preferences.videoDefault}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, videoDefault: value },
                }))
              }
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>App Preferences</Text>

            <Text style={styles.fieldLabel}>Theme</Text>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() =>
                  setDraft((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, theme: "light" },
                  }))
                }
                disabled={!isEditing}
                style={[
                  styles.segment,
                  draft.preferences.theme === "light" && styles.segmentActive,
                  !isEditing && styles.segmentDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    draft.preferences.theme === "light" && styles.segmentTextActive,
                  ]}
                >
                  Light
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setDraft((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, theme: "dark" },
                  }))
                }
                disabled={!isEditing}
                style={[
                  styles.segment,
                  draft.preferences.theme === "dark" && styles.segmentActive,
                  !isEditing && styles.segmentDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    draft.preferences.theme === "dark" && styles.segmentTextActive,
                  ]}
                >
                  Dark
                </Text>
              </Pressable>
            </View>

            <PreferenceRow
              label="Push notifications"
              value={draft.preferences.notifications}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, notifications: value },
                }))
              }
            />
            <PreferenceRow
              label="Show online status"
              value={draft.preferences.showOnlineStatus}
              disabled={!isEditing}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, showOnlineStatus: value },
                }))
              }
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={styles.subscriptionRow}>
              <Text style={styles.planName}>{draft.planName.toUpperCase()} PLAN</Text>
              <Pressable
                onPress={() => router.push("/(app)/billing")}
                style={styles.inlineActionBtn}
              >
                <Text style={styles.inlineActionText}>Manage plan</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {isEditing ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={cancelEditing}
                  style={[styles.actionBtn, styles.secondaryBtn]}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveProfile}
                  style={[
                    styles.actionBtn,
                    styles.primaryBtn,
                    (!hasChanges || isSaving) && styles.disabledBtn,
                  ]}
                  disabled={!hasChanges || isSaving}
                >
                  <Text style={styles.primaryBtnText}>
                    {isSaving ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setIsEditing(true)}
                  style={[styles.actionBtn, styles.primaryBtn]}
                >
                  <Text style={styles.primaryBtnText}>Edit Profile</Text>
                </Pressable>
                <Pressable onPress={resetChanges} style={[styles.actionBtn, styles.secondaryBtn]}>
                  <Text style={styles.secondaryBtnText}>Refresh</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={logout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text style={[styles.preferenceLabel, disabled && styles.disabledText]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: "#B7C5D5", true: "#8FD1BB" }}
        thumbColor={value ? colors.primary : "#EEF3F8"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardLayer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 94,
    gap: 10,
  },
  bgOrbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#D7E9FB",
    top: -110,
    right: -90,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#D8F1E6",
    bottom: -120,
    left: -90,
  },
  header: {
    marginBottom: 4,
  },
  kicker: {
    color: colors.info,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: type.display,
    fontSize: 30,
    lineHeight: 36,
    marginTop: 3,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  profileRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  avatarShell: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#D3E7F8",
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 22,
    fontWeight: "800",
  },
  profileMeta: {
    flex: 1,
    gap: 6,
  },
  name: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 18,
    fontWeight: "800",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  roleBadge: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleBadgeText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedBadge: {
    backgroundColor: "#D5F3E8",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: {
    color: colors.primaryDark,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: "700",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  inlineActionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editCtaBtn: {
    borderColor: colors.primaryDark,
  },
  inlineActionText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: "800",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.65,
  },
  textArea: {
    minHeight: 74,
    textAlignVertical: "top",
  },
  readOnlyField: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    backgroundColor: "#F0F4F8",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  readOnlyText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
  },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  preferenceLabel: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: colors.surfaceSoft,
  },
  segmentDisabled: {
    opacity: 0.6,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  subscriptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  planName: {
    color: colors.primaryDark,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  secondaryBtnText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.55,
  },
  disabledText: {
    opacity: 0.45,
  },
  logoutBtn: {
    marginTop: 6,
    backgroundColor: "#FCEBE8",
    borderWidth: 1,
    borderColor: "#E8C1BB",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  logoutText: {
    color: "#8C2D1E",
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "700",
  },
});
