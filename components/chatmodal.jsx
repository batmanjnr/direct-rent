import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { X, Check, CheckCheck, Paperclip, Smile, Send, Mic, Square } from "lucide-react-native";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { auth } from "../lib/firebase";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "../context/ThemeContext";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  increment,
  getDocs,
  where,
} from "firebase/firestore";
import { uploadFile } from "../lib/storage";
import { createNotification } from "../lib/notifications";
import { calculateVerificationLevel } from "../lib/verification";

export const ChatModal = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  overrideConversationId,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [convStatus, setConvStatus] = useState("inquiry");
  const [convData, setConvData] = useState(null);
  const [error, setError] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(null);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const flatListRef = useRef(null);
  const soundRef = useRef(null);
  const playLockRef = useRef(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState({
    positionMillis: 0,
    durationMillis: 0,
    isPlaying: false,
    rate: 1.0,
  });
  const [isAdoptingConversation, setIsAdoptingConversation] = useState(false);
  const userUnsubRef = useRef(null);

  const initialConversationId =
    overrideConversationId ||
    (currentUser.role === "tenant"
      ? `${currentUser.id}_${listing?.agent?.id || "unknown"}_${listing?.id || "unknown"}`
      : `unknown_${currentUser.id}_${listing?.id || "unknown"}`);

  const [conversationId, setConversationId] = useState(initialConversationId);

  useEffect(() => {
    if (!isOpen) return;
    if (!currentUser || !currentUser.id) {
      setMessages([]);
      setOtherUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (isAdoptingConversation) {
      setError(null);
      return;
    }
    setError(null);

    (async () => {
      if (overrideConversationId && !convData) {
        try {
          const convRef = doc(db, "conversations", overrideConversationId);
          const snap = await getDoc(convRef);
          if (snap.exists()) setConvData(snap.data());
        } catch (err) {
          console.warn("Failed to fetch conversation metadata", err);
        }
      }
    })();

    // Reset unread counts
    (async () => {
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
            }).catch((err) =>
              handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`)
            );
          }
        }
      } catch (err) {
        console.warn("Reset unread failed", err);
      }
    })();

    const convRef = doc(db, "conversations", conversationId);
    const unsubConv = onSnapshot(
      convRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConvStatus(data.status || "inquiry");
          setConvData(data);

          const otherId = currentUser.role === "tenant" ? data.agentId : data.tenantId;
          if (otherId) {
            if (userUnsubRef.current) {
              try { userUnsubRef.current(); } catch (e) {}
              userUnsubRef.current = null;
            }

            userUnsubRef.current = onSnapshot(
              doc(db, "users", otherId),
              (userSnap) => {
                if (userSnap.exists()) {
                  const d = userSnap.data();
                  setOtherUser({
                    name: d.firstName || d.lastName ? `${d.firstName || ""} ${d.lastName || ""}`.trim() : d.name || "User",
                    avatarUrl: d.avatarUrl,
                    verificationLevel: d.verificationLevel === "verified" ? "verified" : calculateVerificationLevel(d),
                    role: d.role,
                    phoneNumber: d.phoneNumber,
                  });
                }
              },
              (err) => handleFirestoreError(err, OperationType.GET, `users/${otherId}`)
            );
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `conversations/${conversationId}`)
    );

    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubMessages = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        setIsLoading(false);
        setError(null);
        setTimeout(() => {
          try {
            if (flatListRef.current && msgs.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          } catch (e) {}
        }, 120);
      },
      (err) => {
        console.error("Chat listener error:", err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubMessages();
      unsubConv();
      if (userUnsubRef.current) {
        try { userUnsubRef.current(); } catch (e) {}
      }
    };
  }, [isOpen, conversationId, currentUser.id, currentUser.role, isAdoptingConversation]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setIsAdoptingConversation(true);
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          if (!cancelled) setIsAdoptingConversation(false);
          return;
        }

        const listingId = listing?.id?.toString() || convData?.listingId?.toString() || "unknown";
        const agentIdCandidate = listing?.agent?.id || convData?.agentId || (currentUser.role === "agent" ? currentUser.id : null);
        if (!listingId || listingId === "unknown" || !agentIdCandidate) {
          if (!cancelled) setIsAdoptingConversation(false);
          return;
        }

        const q = query(collection(db, "conversations"), where("listingId", "==", listingId), where("agentId", "==", agentIdCandidate));
        const snaps = await getDocs(q);
        if (!snaps.empty && !cancelled) {
          setConversationId(snaps.docs[0].id);
        }
      } catch (e) {
        console.warn("conversation adopt lookup failed", e);
      } finally {
        if (!cancelled) setIsAdoptingConversation(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, listing?.id, convData?.listingId, currentUser.id, currentUser.role]);

  // Safely converts native app-cached paths into standard uploadable blobs via accurate Base64 array parsing
  const uriToBlob = async (uri) => {
    try {
      const base64String = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await fetch(`data:audio/x-m4a;base64,${base64String}`);
      return await response.blob();
    } catch (e) {
      console.warn("Base64 blob parser fallback initiated:", e);
      const response = await fetch(uri);
      return await response.blob();
    }
  };

  const ensureConversationExists = async (lastMsg) => {
    try { await ensureFreshAuth(); } catch (e) {}
    let convRef = doc(db, "conversations", conversationId);
    let convDoc = await getDoc(convRef);
    if (!convDoc.exists()) {
      const agentId = listing?.agent?.id || convData?.agentId || "unknown";
      const tenantId = convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0] || "unknown");
      let agentImage = listing?.agent?.avatarUrl || convData?.agentImage || "";
      const listingId = listing?.id?.toString() || convData?.listingId?.toString() || "unknown";

      await setDoc(convRef, {
        id: convRef.id,
        tenantId: tenantId,
        agentId: agentId,
        listingId: listingId,
        tenantName: `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "User",
        agentName: listing?.agent?.name || convData?.agentName || "Agent",
        tenantImage: currentUser.avatarUrl || "",
        agentImage: agentImage,
        listingTitle: listing?.title || convData?.listingTitle || "",
        listingImage: listing?.image || convData?.listingImage || "",
        listingPrice: listing?.price || convData?.listingPrice || "",
        status: "inquiry",
        updatedAt: serverTimestamp(),
        lastMessage: lastMsg,
        unreadCount_tenant: currentUser.role === "tenant" ? 0 : 1,
        unreadCount_agent: currentUser.role === "agent" ? 0 : 1,
      });
    } else {
      await updateDoc(convRef, {
        lastMessage: lastMsg,
        updatedAt: serverTimestamp(),
        [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1),
      });
    }
  };

  const sendTextMessage = async (text) => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      await ensureConversationExists(text.trim());
      const agentId = listing?.agent?.id || convData?.agentId || "unknown";
      const tenantId = convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]);
      const senderUid = auth?.currentUser?.uid || currentUser.id;

      await addDocWithRetry(collection(db, "conversations", conversationId, "messages"), {
        content: text.trim(),
        senderId: senderUid,
        tenantId: tenantId,
        agentId: agentId,
        type: "text",
        createdAt: serverTimestamp(),
        read: false,
      });

      setNewMessage("");
    } catch (err) {
      setError("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!res || res.type === "cancel" || !res.assets?.[0]) return;
      
      setIsSending(true);
      const targetAsset = res.assets[0];
      const blob = await uriToBlob(targetAsset.uri);
      const url = await uploadFile(blob, `conversations/${conversationId}/attachments/${currentUser.id}/${Date.now()}_${targetAsset.name}`);

      await ensureConversationExists("[Attachment]");
      await addDocWithRetry(collection(db, "conversations", conversationId, "messages"), {
        content: targetAsset.name || "Attachment",
        fileUrl: url,
        fileType: targetAsset.mimeType || "file",
        senderId: auth?.currentUser?.uid || currentUser.id,
        tenantId: convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]),
        agentId: listing?.agent?.id || convData?.agentId || "unknown",
        type: "file",
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (err) {
      setError("Failed to attach document.");
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const permissions = await Audio.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert("Permission Required", "Please allow access to microphone to record.");
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      
      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);
    } catch (err) {
      console.warn("Recording start failed:", err);
      Alert.alert("Recording error", "Unable to access native audio input stream.");
    }
  };

  const stopRecordingAndSend = async () => {
    let uri;
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      
      if (!uri) throw new Error("No tracking audio path file produced");
    } catch (err) {
      console.warn("Recording stop failed:", err);
      setIsRecording(false);
      Alert.alert("Error", "Could not stop audio processing device cleanly.");
      return;
    }

    setIsSending(true);
    try {
      const blob = await uriToBlob(uri);
      const url = await uploadFile(blob, `conversations/${conversationId}/attachments/${currentUser.id}/audio_${Date.now()}.m4a`);
      await ensureConversationExists("[Voice Note]");

      await addDocWithRetry(collection(db, "conversations", conversationId, "messages"), {
        content: "Voice note",
        fileUrl: url,
        fileType: "audio",
        senderId: auth?.currentUser?.uid || currentUser.id,
        tenantId: convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]),
        agentId: listing?.agent?.id || convData?.agentId || "unknown",
        type: "audio",
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (err) {
      console.warn("Upload audio failed:", err);
      Alert.alert("Send failed", "Unable to upload voice note to cloud storage.");
    } finally {
      setIsSending(false);
    }
  };

  const playVoiceMessage = async (message) => {
    try {
      if (playingMessageId === message.id) {
        if (playbackStatus.isPlaying) {
          await soundRef.current?.pauseAsync();
        } else {
          await soundRef.current?.playAsync();
        }
        return;
      }
      if (playLockRef.current) return;
      playLockRef.current = true;

      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (e) {}
        soundRef.current = null;
      }

      setPlayingMessageId(message.id);
      setPlaybackStatus((p) => ({ ...p, positionMillis: 0, durationMillis: 0, isPlaying: false }));

      const { sound } = await Audio.Sound.createAsync(
        { uri: message.fileUrl },
        { shouldPlay: true, rate: playbackStatus.rate, shouldCorrectPitch: true }
      );
      soundRef.current = sound;
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        setPlaybackStatus({
          positionMillis: status.positionMillis || 0,
          durationMillis: status.durationMillis || 0,
          isPlaying: status.isPlaying || false,
          rate: status.rate || 1.0,
        });
        if (status.didJustFinish) {
          setPlayingMessageId(null);
        }
      });
      playLockRef.current = false;
    } catch (err) {
      setPlayingMessageId(null);
      playLockRef.current = false;
    }
  };

  async function changePlaybackRate() {
    const rates = [1.0, 1.5, 2.0];
    const currentRate = playbackStatus?.rate || 1.0;
    const idx = rates.indexOf(currentRate) >= 0 ? rates.indexOf(currentRate) : 0;
    const next = rates[(idx + 1) % rates.length];
    setPlaybackStatus((p) => ({ ...p, rate: next }));
    if (soundRef.current) {
      await soundRef.current.setRateAsync(next, true);
    }
  }

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return "0:00";
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const renderMessageTicks = (item, isMine) => {
    if (!isMine) return null;
    return item.read ? (
      <CheckCheck size={15} color="#34b7f1" style={styles.ticks} />
    ) : (
      <CheckCheck size={15} color={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"} style={styles.ticks} />
    );
  };

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === currentUser.id;
    const isAudio = item.type === "audio" || item.fileType === "audio";

    const timeString = item.createdAt 
      ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : "";

    if (isAudio) {
      const isCurrentPlaying = playingMessageId === item.id;
      return (
        <View style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft, { minWidth: '72%' }]}>
          <View style={styles.whatsappAudioRow}>
            <View style={styles.voiceAvatarContainer}>
              {isMine ? (
                currentUser?.avatarUrl ? (
                  <Image source={{ uri: currentUser.avatarUrl }} style={styles.voiceAvatar} />
                ) : (
                  <View style={[styles.voiceAvatar, styles.voiceAvatarPlaceholder]}><Text style={styles.voiceAvatarTxt}>U</Text></View>
                )
              ) : (
                otherUser?.avatarUrl ? (
                  <Image source={{ uri: otherUser.avatarUrl }} style={styles.voiceAvatar} />
                ) : (
                  <View style={[styles.voiceAvatar, styles.voiceAvatarPlaceholder]}><Text style={styles.voiceAvatarTxt}>A</Text></View>
                )
              )}
              <TouchableOpacity onPress={() => playVoiceMessage(item)} style={styles.waPlayButton}>
                <Text style={{ color: "#fff", fontSize: 11 }}>
                  {isCurrentPlaying && playbackStatus.isPlaying ? "⏸" : "▶"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.waAudioTimeline}>
              <View style={styles.waProgressContainer}>
                <View style={[styles.waProgressBackground, { backgroundColor: isMine ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.1)" }]}>
                  <View style={[styles.waProgressFill, {
                    backgroundColor: isMine ? "#34b7f1" : "#059669",
                    width: `${isCurrentPlaying && playbackStatus.durationMillis ? (playbackStatus.positionMillis / playbackStatus.durationMillis) * 100 : 0}%`
                  }]} />
                </View>
              </View>
              <View style={styles.waAudioMetaRow}>
                <Text style={[styles.waAudioTime, { color: isMine ? "rgba(255,255,255,0.8)" : "rgba(15,23,42,0.6)" }]}>
                  {formatTime(isCurrentPlaying ? playbackStatus.positionMillis : 0)}
                </Text>
                <View style={styles.timeAndTicksRow}>
                  <Text style={[styles.bubbleTime, { color: isMine ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.5)" }]}>{timeString}</Text>
                  {renderMessageTicks(item, isMine)}
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={changePlaybackRate} style={[styles.waSpeedBadge, { backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)" }]}>
              <Text style={[styles.waSpeedText, { color: isMine ? "#fff" : "#0f172a" }]}>
                {isCurrentPlaying ? playbackStatus.rate : 1}x
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
        <Text style={isMine ? styles.bubbleTextRight : styles.bubbleTextLeft}>
          {item.content}
        </Text>
        <View style={styles.textMetaContainer}>
          <Text style={[styles.bubbleTime, { color: isMine ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.5)" }]}>
            {timeString}
          </Text>
          {renderMessageTicks(item, isMine)}
        </View>
      </View>
    );
  };

  const handleMakePayment = () => {
    const url = listing?.paymentLink || convData?.paymentLink;
    if (url) { FileSystem.openUrl(url); }
  };

  async function ensureFreshAuth() {
    if (auth?.currentUser?.getIdToken) { await auth.currentUser.getIdToken(true); }
    return auth?.currentUser?.uid;
  }

  const addDocWithRetry = async (ref, payload, retries = 1) => {
    try { return await addDoc(ref, payload); } catch (err) {
      if (retries > 0) {
        await ensureFreshAuth();
        return addDocWithRetry(ref, payload, retries - 1);
      }
      throw err;
    }
  };

  const emojis = ["😀", "😂", "😍", "👍", "🙏", "🔥", "🎉", "✨"];

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: isDark ? "rgba(11, 17, 32, 0.96)" : "#ffffff" }]}>
        <SafeAreaView style={styles.glassContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
            
            {/* Header Plate */}
            <View style={[styles.glassHeader, { 
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(248, 250, 252, 0.95)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.08)"
            }]}>
              <View style={styles.headerLeft}>
                <View style={styles.avatar}>
                  {otherUser?.avatarUrl ? (
                    <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{(otherUser?.name || "A").charAt(0)}</Text>
                  )}
                </View>
                <View>
                  <Text style={[styles.title, { color: isDark ? "#fff" : "#1e293b" }]}>{otherUser?.name || "Loading..."}</Text>
                  <Text style={styles.status}>online</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={isDark ? "#fff" : "#1e293b"} />
              </TouchableOpacity>
            </View>

            {/* Context Module */}
            <View style={[styles.referenceModule, { 
              backgroundColor: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(241, 245, 249, 0.9)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"
            }]}>
              <Image source={{ uri: listing?.image || convData?.listingImage }} style={styles.refImage} />
              <View style={styles.refMeta}>
                <Text style={[styles.refTitle, { color: isDark ? "#f1f5f9" : "#334155" }]} numberOfLines={1}>
                  {listing?.title || convData?.listingTitle}
                </Text>
                <Text style={styles.priceText}>{listing?.price || convData?.listingPrice}</Text>
              </View>
              {currentUser?.role !== "agent" && (
                <View style={styles.headerActionRow}>
                  <TouchableOpacity onPress={handleMakePayment} style={styles.payBtn}>
                    <Text style={styles.payBtnText}>Pay</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Message Feed Canvas */}
            <View style={styles.messagesWrap}>
              {isLoading ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderMessage}
                  keyExtractor={(item, index) => item?.id || index.toString()}
                  contentContainerStyle={{ padding: 16 }}
                />
              )}
            </View>

            {/* Input Footer System */}
            <View style={[styles.glassInputFooter, { 
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(248, 250, 252, 0.95)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.08)"
            }]}>
              
              {emojiVisible && (
                <View style={[styles.emojiTrayWrap, { backgroundColor: isDark ? "rgba(30, 41, 59, 0.96)" : "rgba(255, 255, 255, 0.98)" }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {emojis.map((e) => (
                      <TouchableOpacity key={e} onPress={() => { setNewMessage((s) => s + e); setEmojiVisible(false); }} style={styles.emojiButton}>
                        <Text style={styles.emojiText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.inputRow}>
                <TouchableOpacity onPress={pickDocument} style={styles.iconAction}>
                  <Paperclip size={21} color={isDark ? "#94a3b8" : "#475569"} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setEmojiVisible((v) => !v)} style={styles.iconAction}>
                  <Smile size={21} color={isDark ? "#94a3b8" : "#475569"} />
                </TouchableOpacity>

                <TextInput
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(15, 23, 42, 0.5)"}
                  style={[styles.textInput, { 
                    backgroundColor: isDark ? "rgba(0, 0, 0, 0.4)" : "#ffffff",
                    color: isDark ? "#fff" : "#0f172a",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.15)"
                  }]}
                  editable={!isSending}
                />

                <View style={styles.actionGroup}>
                  {newMessage.trim().length > 0 ? (
                    <TouchableOpacity onPress={() => sendTextMessage(newMessage)} style={styles.sendActionButton}>
                      <Send size={18} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={isRecording ? stopRecordingAndSend : startRecording} style={[styles.sendActionButton, isRecording && styles.recordingActive]}>
                      {isRecording ? <Square size={16} color="#fff" /> : <Mic size={18} color="#fff" />}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  glassContainer: { flex: 1 },
  glassHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(5, 150, 105, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 20 },
  avatarText: { fontWeight: "700", color: "#059669" },
  title: { fontWeight: "600", fontSize: 16 },
  status: { fontSize: 12, color: "#10b981", fontWeight: "500", marginTop: 1 },
  closeButton: { padding: 4 },
  referenceModule: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  refImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12 },
  refMeta: { flex: 1 },
  refTitle: { fontWeight: "500", fontSize: 14 },
  priceText: { color: "#10b981", fontWeight: "600", fontSize: 13, marginTop: 2 },
  headerActionRow: { flexDirection: "row" },
  payBtn: { backgroundColor: "#10b981", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  payBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  messagesWrap: { flex: 1 },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 4,
    borderRadius: 20,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  bubbleLeft: {
    backgroundColor: "rgba(241, 245, 249, 0.9)",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
  },
  bubbleRight: {
    backgroundColor: "#059669",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  bubbleTextLeft: { color: "#0f172a", fontSize: 15, lineHeight: 20 },
  bubbleTextRight: { color: "#fff", fontSize: 15, lineHeight: 20 },
  textMetaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  bubbleTime: { fontSize: 10, marginRight: 3 },
  ticks: { marginLeft: 2, marginBottom: -1 },
  whatsappAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  voiceAvatarContainer: {
    position: "relative",
    marginRight: 10,
    width: 36,
    height: 36,
  },
  voiceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  voiceAvatarPlaceholder: {
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceAvatarTxt: {
    fontSize: 12,
    fontWeight: "bold",
  },
  waPlayButton: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  waAudioTimeline: {
    flex: 1,
    justifyContent: "center",
  },
  waProgressContainer: {
    paddingVertical: 6,
  },
  waProgressBackground: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  waProgressFill: {
    height: "100%",
  },
  waAudioMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  waAudioTime: {
    fontSize: 11,
  },
  timeAndTicksRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  waSpeedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  waSpeedText: {
    fontSize: 11,
    fontWeight: "600",
  },
  glassInputFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  iconAction: { padding: 6, marginRight: 4 },
  textInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginHorizontal: 8,
    fontSize: 15,
  },
  actionGroup: { marginLeft: 2 },
  sendActionButton: {
    backgroundColor: "#059669",
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  recordingActive: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
  },
  emojiTrayWrap: {
    position: "absolute",
    bottom: 68,
    left: 12,
    right: 12,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  emojiButton: { padding: 6, marginRight: 8 },
  emojiText: { fontSize: 20 },
});

export default ChatModal;