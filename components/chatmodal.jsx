import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  X,
  Send,
  Paperclip,
  Mic,
  FileText,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
} from "lucide-react-native";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { calculateVerificationLevel } from "../lib/verification";
import { createNotification } from "../lib/notifications";
import { useAuth } from "../context/AuthContext";

const ChatModal = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  overrideConversationId,
  conversationId: conversationIdProp,
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [convStatus, setConvStatus] = useState("inquiry");
  const [convData, setConvData] = useState(null);
  const [error, setError] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const flatListRef = useRef(null);

  // Accept an explicit conversationId prop (preferred), otherwise honor overrideConversationId,
  // otherwise fallback to computed id using currentUser + listing. Guard against missing data.
  const conversationId =
    conversationIdProp ||
    overrideConversationId ||
    (currentUser && listing
      ? currentUser.role === "tenant"
        ? `${currentUser.id}_${listing.agent?.id || "unknown"}_${listing.id}`
        : `unknown_${currentUser.id}_${listing.id}`
      : null);

  useEffect(() => {
    if (!isOpen) return;
    if (!conversationId) {
      setIsLoading(false);
      setError("No conversation specified");
      return;
    }

    // Guard: currentUser must be provided
    if (!currentUser) {
      console.warn("ChatModal: missing currentUser prop");
      setError("User not available");
      setIsLoading(false);
      return;
    }

    // Guard: listing must be provided for new conversations
    if (!listing) {
      console.warn("ChatModal: missing listing prop");
      // continue because conversationId might already exist, but many actions require listing
    }

    const resetUnread = async () => {
      try {
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          const fieldToReset =
            currentUser.role === "tenant"
              ? "unreadCount_tenant"
              : "unreadCount_agent";
          if (convSnap.data()[fieldToReset] > 0) {
            await updateDoc(convRef, {
              [fieldToReset]: 0,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        console.error("Error resetting unread count:", err);
      }
    };
    resetUnread();

    setIsLoading(true);
    const convRef = doc(db, "conversations", conversationId);
    let unsubOther;

    const unsubConv = onSnapshot(convRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConvStatus(data.status || "inquiry");
        setConvData(data);

        const otherId =
          currentUser?.role === "tenant" ? data.agentId : data.tenantId;
        if (otherId && !unsubOther) {
          unsubOther = onSnapshot(doc(db, "users", otherId), (userSnap) => {
            if (userSnap.exists()) {
              const d = userSnap.data();
              setOtherUser({
                name:
                  d.firstName || d.lastName
                    ? `${d.firstName || ""} ${d.lastName || ""}`.trim()
                    : d.name || "User",
                avatarUrl: d.avatarUrl,
                verificationLevel:
                  d.verificationLevel === "verified"
                    ? "verified"
                    : calculateVerificationLevel(d),
                role: d.role,
              });
            }
          });
        }
      }
    });

    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );
    // Listen to all messages for this conversation ordered by creation time.
    // Filtering by tenantId/agentId is unnecessary because messages are scoped under the conversation document.
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubConv) unsubConv();
      if (unsubOther) unsubOther();
    };
  }, [isOpen, conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      const convRef = doc(db, "conversations", conversationId);
      const agentId = listing?.agent?.id || "unknown";
      const convDoc = await getDoc(convRef);

      if (!convDoc.exists()) {
        await setDoc(convRef, {
          id: conversationId,
          tenantId: currentUser?.id || "unknown",
          agentId,
          listingId: listing?.id?.toString() || "unknown",
          tenantName:
            currentUser?.name ||
            `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim(),
          agentName: listing?.agent?.name || "Agent",
          listingTitle: listing?.title || "",
          listingImage: listing?.image || "",
          status: "inquiry",
          updatedAt: serverTimestamp(),
          lastMessage: newMessage.trim(),
          unreadCount_tenant: currentUser?.role === "tenant" ? 0 : 1,
          unreadCount_agent: currentUser?.role === "agent" ? 0 : 1,
        });
      } else {
        await updateDoc(convRef, {
          lastMessage: newMessage.trim(),
          updatedAt: serverTimestamp(),
          [currentUser?.role === "tenant"
            ? "unreadCount_agent"
            : "unreadCount_tenant"]: increment(1),
        });
      }

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        {
          content: newMessage.trim(),
          senderId: currentUser?.id || "unknown",
          tenantId:
            currentUser?.role === "tenant"
              ? currentUser?.id || "unknown"
              : conversationId.split("_")[0],
          agentId,
          type: "text",
          createdAt: serverTimestamp(),
        },
      );

      setNewMessage("");
    } catch (err) {
      setError("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === currentUser.id;
    if (item.type === "action") {
      return (
        <View style={styles.actionContainer}>
          <Text style={styles.actionText}>{item.content}</Text>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.messageWrapper,
          isMine ? styles.myMsgWrapper : styles.theirMsgWrapper,
        ]}
      >
        <View
          style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}
        >
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myText : styles.theirText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.container}>
          
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View style={styles.avatarPlaceholder}>
                {otherUser?.avatarUrl ? (
                  <Image
                    source={{ uri: otherUser.avatarUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {(otherUser?.name || "A").charAt(0)}
                  </Text>
                )}
              </View>
              <View>
                <Text style={styles.userName}>
                  {otherUser?.name || "Loading..."}
                </Text>
                <Text style={styles.statusText}>• Active</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.iconBtn}>
              <Paperclip size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !newMessage.trim() && styles.disabledSend,
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ArrowRight size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  container: {
    height: "90%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  userInfo: { flexDirection: "row", alignItems: "center" },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  avatarInitial: { fontWeight: "bold", color: "#0ea5e9" },
  userName: { fontWeight: "bold", fontSize: 16, color: "#0f172a" },
  statusText: { fontSize: 10, color: "#10b981", fontWeight: "bold" },
  messageList: { padding: 16 },
  messageWrapper: { marginBottom: 12, flexDirection: "row" },
  myMsgWrapper: { justifyContent: "flex-end" },
  theirMsgWrapper: { justifyContent: "flex-start" },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: "85%",
  },
  myBubble: { backgroundColor: "#0284c7", borderBottomRightRadius: 0 },
  theirBubble: { backgroundColor: "#f1f5f9", borderBottomLeftRadius: 0 },
  myText: { color: "#fff" },
  theirText: { color: "#0f172a" },
  actionContainer: {
    alignSelf: "center",
    marginVertical: 20,
    padding: 12,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  actionText: { fontSize: 12, color: "#4f46e5", textAlign: "center" },
  inputArea: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingBottom: 32,
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0284c7",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledSend: { backgroundColor: "#cbd5e1" },
});

export default ChatModal;
