import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type } from "@/src/theme/colors";
import {
  ChatConversation,
  ChatMessage,
  mockConversations,
  mockMessagesByConversation,
  simulatedReplies,
} from "@/src/data/mockChat";

export default function ChatScreen() {
  const [conversations, setConversations] =
    useState<ChatConversation[]>(mockConversations);
  const [messagesByConversation, setMessagesByConversation] =
    useState<Record<string, ChatMessage[]>>(mockMessagesByConversation);
  const [activeConversationId, setActiveConversationId] = useState(
    mockConversations[0]?.id ?? ""
  );
  const [draft, setDraft] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(
    () => messagesByConversation[activeConversationId] ?? [],
    [messagesByConversation, activeConversationId]
  );

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeConversationId || !activeConversation) return;

    const nowIso = new Date().toISOString();
    const myMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: "me",
      text,
      sentAt: nowIso,
    };

    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] ?? []), myMessage],
    }));

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeConversationId
          ? { ...conv, lastMessage: text, lastMessageAt: nowIso, unreadCount: 0 }
          : conv
      )
    );

    setDraft("");

    const simulatedReply =
      simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

    setTimeout(() => {
      const replyIso = new Date().toISOString();
      const replyMessage: ChatMessage = {
        id: `m-${Date.now()}-reply`,
        sender: "them",
        text: simulatedReply,
        sentAt: replyIso,
      };

      setMessagesByConversation((prev) => ({
        ...prev,
        [activeConversationId]: [
          ...(prev[activeConversationId] ?? []),
          replyMessage,
        ],
      }));

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? {
                ...conv,
                lastMessage: simulatedReply,
                lastMessageAt: replyIso,
                unreadCount: 0,
              }
            : conv
        )
      );
    }, 900);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior="padding"
        keyboardVerticalOffset={78}
      >
        <View style={styles.bgOrbTop} />
        <View style={styles.bgOrbBottom} />

        <View style={styles.header}>
          <Text style={styles.kicker}>Direct Messages</Text>
          <Text style={styles.title}>Realtime chat simulation</Text>
          <Text style={styles.subtitle}>Type and send messages locally.</Text>
        </View>

        <View style={styles.railWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={conversations}
            keyExtractor={(item) => item.id}
            style={styles.railList}
            contentContainerStyle={styles.conversationRail}
            renderItem={({ item }) => {
              const isActive = item.id === activeConversationId;
              return (
                <Pressable
                  onPress={() => openConversation(item.id)}
                  style={[
                    styles.contactChip,
                    isActive && styles.contactChipActive,
                  ]}
                >
                  <View style={styles.contactRow}>
                    <View
                      style={[
                        styles.avatarDot,
                        isActive && styles.avatarDotActive,
                      ]}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.contactName,
                        isActive && styles.contactNameActive,
                      ]}
                    >
                      {item.displayName}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.chatTitle}>
              {activeConversation?.displayName ?? "No contact"}
            </Text>
            <Text style={styles.chatSubtitle}>
              {activeConversation?.isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <FlatList
          data={activeMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item }) => {
            const isMe = item.sender === "me";
            return (
              <View
                style={[
                  styles.messageBubble,
                  isMe ? styles.myBubble : styles.theirBubble,
                ]}
              >
                <Text style={[styles.messageText, isMe && styles.myBubbleText]}>
                  {item.text}
                </Text>
                <Text style={[styles.messageMeta, isMe && styles.myMeta]}>
                  {formatTime(item.sentAt)}
                </Text>
              </View>
            );
          }}
        />

        <View style={styles.composerRow}>
          <TextInput
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim()}
            style={[
              styles.sendButton,
              !draft.trim() && styles.sendButtonDisabled,
            ]}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  keyboardLayer: {
    flex: 1,
  },
  bgOrbTop: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#D7E9FB",
    top: -80,
    right: -80,
  },
  bgOrbBottom: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#D7EFE4",
    bottom: -100,
    left: -80,
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
    fontSize: 28,
    lineHeight: 34,
    marginTop: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 14,
    marginTop: 2,
  },
  railWrap: {
    height: 40,
    marginBottom: 6,
  },
  railList: {
    flexGrow: 0,
  },
  conversationRail: {
    gap: 8,
    alignItems: "center",
    paddingVertical: 2,
  },
  contactChip: {
    width: 102,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 9,
    paddingHorizontal: 8,
    height: 30,
    justifyContent: "center",
  },
  contactChipActive: {
    backgroundColor: "#EAF4F0",
    borderColor: "#8CCDB4",
    width: 86,
    height: 24,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  avatarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#9AB0C7",
  },
  avatarDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  contactName: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
    flex: 1,
  },
  contactNameActive: {
    color: colors.primaryDark,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 10,
    fontWeight: "800",
  },
  chatPanel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 18,
    padding: 12,
    marginBottom: 66,
  },
  chatHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
    paddingBottom: 8,
    marginBottom: 8,
  },
  chatTitle: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: "800",
  },
  chatSubtitle: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 12,
  },
  messageBubble: {
    maxWidth: "83%",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  theirBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  messageText: {
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  myBubbleText: {
    color: colors.primaryText,
  },
  messageMeta: {
    color: colors.textMuted,
    fontFamily: type.body,
    fontSize: 11,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  myMeta: {
    color: "#D9F2E7",
  },
  composerRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: type.body,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: colors.primaryText,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: "800",
  },
});
