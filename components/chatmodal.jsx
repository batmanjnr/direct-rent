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
import { Audio } from "expo-av"; // requires: expo install expo-av (or replace with your preferred recorder)
import * as ImagePicker from "expo-image-picker"; // expo-image-picker is already in package.json
import * as DocumentPicker from "expo-document-picker"; // npm: expo install expo-document-picker
import { X } from "lucide-react-native";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { auth } from "../lib/firebase";
import * as FileSystem from "expo-file-system/legacy";

// Use legacy FileSystem API for downloadAsync to avoid deprecation warning in recent Expo SDKs

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

// NOTE: This React Native component assumes the app is configured with the
// necessary native modules. Install the following (or your preferred alternatives):
// - Expo + expo-av for audio recording: expo install expo-av
// - expo-image-picker for image selection: expo install expo-image-picker (already present)
// - expo-document-picker for documents: expo install expo-document-picker
// After installing, follow each library's native setup guides if you're not using the managed Expo workflow.

export const ChatModal = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  overrideConversationId,
}) => {
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
  // Audio playback state/ref for voice-note UI
  const soundRef = useRef(null);
  const progressWidthRef = useRef({}); // store measured progress widths per message id
  const playLockRef = useRef(false); // prevent re-entrant play attempts
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState({
    positionMillis: 0,
    durationMillis: 0,
    isPlaying: false,
    rate: 1.0,
  });
  // When opening the modal, we may need to "adopt" an existing conversation.
  // This flag prevents the main listeners from attaching to a temporary/stale
  // conversationId while we search for a canonical conversation document.
  const [isAdoptingConversation, setIsAdoptingConversation] = useState(false);
  // ref to store a nested onSnapshot unsubscribe for the /users/{id} listener
  const userUnsubRef = useRef(null);

  // stable conversation id: prefer override (opened from inbox). Build safely when listing may be undefined.
  const initialConversationId =
    overrideConversationId ||
    (currentUser.role === "tenant"
      ? `${currentUser.id}_${listing?.agent?.id || "unknown"}_${listing?.id || "unknown"}`
      : `unknown_${currentUser.id}_${listing?.id || "unknown"}`);

  // make conversationId stateful so we can discover and adopt an existing conversation created by the other party
  const [conversationId, setConversationId] = useState(initialConversationId);

  useEffect(() => {
    if (!isOpen) return;

    // If there's no authenticated user, don't attach listeners. This avoids
    // permission-denied errors when the app navigates to the login screen and
    // some components still try to subscribe to secure documents.
    if (!currentUser || !currentUser.id) {
      setMessages([]);
      setOtherUser(null);
      setIsLoading(false);
      return;
    }

    // If an adoption lookup is running, skip attaching listeners — the
    // effect will re-run when `isAdoptingConversation` becomes false so the
    // listeners attach to the canonical conversation document.
    setIsLoading(true);
    if (isAdoptingConversation) {
      setError(null);
      return; // wait for adoption to complete
    }
    setError(null);

    // If opened from inbox with overrideConversationId and listing prop is missing,
    // try to fetch conversation metadata once so listing info (price/title/image) is available.
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

    // Reset unread (best-effort)
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
              handleFirestoreError(
                err,
                OperationType.UPDATE,
                `conversations/${conversationId}`,
              ),
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

          const otherId =
            currentUser.role === "tenant" ? data.agentId : data.tenantId;
          if (otherId) {
            // Ensure previous user listener is removed before attaching a new one.
            if (userUnsubRef.current) {
              try {
                userUnsubRef.current();
              } catch (e) {}
              userUnsubRef.current = null;
            }

            userUnsubRef.current = onSnapshot(
              doc(db, "users", otherId),
              (userSnap) => {
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
                    phoneNumber: d.phoneNumber,
                  });
                }
              },
              (err) =>
                handleFirestoreError(
                  err,
                  OperationType.GET,
                  `users/${otherId}`,
                ),
            );
          }
        }
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `conversations/${conversationId}`,
        ),
    );

    // Keep track of nested user listener and ensure it is cleared when outer unsubscribes
    const cleanup = () => {
      if (userUnsubRef.current) {
        try {
          userUnsubRef.current();
        } catch (e) {}
        userUnsubRef.current = null;
      }
    };

    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubMessages = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        setIsLoading(false);
        setError(null);
        // Auto-scroll to latest message
        setTimeout(() => {
          try {
            if (flatListRef.current && msgs.length > 0) {
              // prefer scrollToEnd if available
              if (flatListRef.current.scrollToEnd) {
                flatListRef.current.scrollToEnd({ animated: true });
              } else if (flatListRef.current.scrollToOffset) {
                flatListRef.current.scrollToOffset({
                  offset: 999999,
                  animated: true,
                });
              } else if (flatListRef.current.scrollToIndex) {
                flatListRef.current.scrollToIndex({
                  index: msgs.length - 1,
                  animated: true,
                });
              }
            }
          } catch (e) {
            // ignore scroll errors (e.g., index out of range)
          }
        }, 120);
      },
      (err) => {
        console.error("Chat listener error:", err);
        handleFirestoreError(
          err,
          OperationType.LIST,
          `conversations/${conversationId}/messages`,
        );
        if (err.code === "permission-denied") {
          if (convData)
            setError(
              "Missing permissions. Please ensure your session is active.",
            );
        } else setError("Failed to load messages.");
        setIsLoading(false);
      },
    );

    return () => {
      unsubMessages();
      unsubConv();
      cleanup();
    };
  }, [
    isOpen,
    conversationId,
    currentUser.id,
    currentUser.role,
    isAdoptingConversation,
  ]);
  // Note: added isAdoptingConversation to dependencies so effect re-runs when adoption finishes.

  // Try to find and adopt an existing conversation when the modal opens.
  // This runs before the main listeners attach and prevents the component
  // from subscribing to a stale/incorrect conversationId (common when
  // the other party created the conversation with a different client-side id).
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
          return; // already exists, nothing to do
        }

        const listingId =
          listing?.id?.toString() ||
          convData?.listingId?.toString() ||
          "unknown";
        const agentIdCandidate =
          listing?.agent?.id ||
          convData?.agentId ||
          (currentUser.role === "agent" ? currentUser.id : null);
        if (!listingId || listingId === "unknown" || !agentIdCandidate) {
          if (!cancelled) setIsAdoptingConversation(false);
          return;
        }

        const q = query(
          collection(db, "conversations"),
          where("listingId", "==", listingId),
          where("agentId", "==", agentIdCandidate),
        );
        const snaps = await getDocs(q);
        if (!snaps.empty && !cancelled) {
          const found = snaps.docs[0];
          // adopt existing conversation id so the real-time listeners attach to the correct doc
          setConversationId(found.id);
        }
      } catch (e) {
        console.warn("conversation adopt lookup failed", e);
      } finally {
        if (!cancelled) setIsAdoptingConversation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    listing?.id,
    convData?.listingId,
    currentUser.id,
    currentUser.role,
  ]);

  const uriToBlob = async (uri) => {
    // Convert local file uri to Blob for upload. Works for Expo and RN > 0.60 in many cases.
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob;
    } catch (e) {
      // Fallback for Android content:// URIs or other cases where fetch(uri) fails.
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const dataUrl = `data:application/octet-stream;base64,${b64}`;
        const res2 = await fetch(dataUrl);
        const blob2 = await res2.blob();
        return blob2;
      } catch (e2) {
        console.error("uriToBlob fallback failed", e, e2);
        throw e2 || e;
      }
    }
  };

  const ensureConversationExists = async (lastMsg) => {
    // Ensure auth token is fresh before creating/updating conversation documents
    try {
      await ensureFreshAuth();
    } catch (e) {
      console.warn(
        "ensureFreshAuth before conversation create/update failed",
        e,
      );
    }
    let convRef = doc(db, "conversations", conversationId);
    let convDoc = await getDoc(convRef);
    if (!convDoc.exists()) {
      // Attempt to locate an existing conversation for this listing and agent (covers agent opening a tenant-created convo)
      try {
        const listingId =
          listing?.id?.toString() ||
          convData?.listingId?.toString() ||
          "unknown";
        const agentIdCandidate =
          listing?.agent?.id ||
          convData?.agentId ||
          (currentUser.role === "agent" ? currentUser.id : null);
        if (listingId && listingId !== "unknown" && agentIdCandidate) {
          const q = query(
            collection(db, "conversations"),
            where("listingId", "==", listingId),
            where("agentId", "==", agentIdCandidate),
          );
          const snaps = await getDocs(q);
          if (!snaps.empty) {
            const found = snaps.docs[0];
            // adopt existing conversation id
            setConversationId(found.id);
            convRef = doc(db, "conversations", found.id);
            convDoc = found;
          }
        }
      } catch (e) {
        // ignore search errors and continue to create a new conversation if not found
        console.warn("conversation lookup failed", e);
      }

      if (!convDoc.exists()) {
        // Determine participant ids more robustly using listing or convData or currentUser role
        const agentId =
          listing?.agent?.id ||
          convData?.agentId ||
          (currentUser.role === "agent" ? currentUser.id : "unknown");
        const tenantId =
          convData?.tenantId ||
          (currentUser.role === "tenant"
            ? currentUser.id
            : conversationId.split("_")[0] || "unknown");

        let agentImage =
          listing?.agent?.avatarUrl || convData?.agentImage || "";
        if (!agentImage && agentId !== "unknown") {
          const agentDoc = await getDoc(doc(db, "users", agentId));
          if (agentDoc.exists()) agentImage = agentDoc.data().avatarUrl || "";
        }

        const listingId =
          listing?.id?.toString() ||
          convData?.listingId?.toString() ||
          "unknown";
        const listingTitle = listing?.title || convData?.listingTitle || "";
        const listingImage = listing?.image || convData?.listingImage || "";
        const listingPrice = listing?.price || convData?.listingPrice || "";

        await setDoc(convRef, {
          id: convRef.id,
          tenantId: tenantId,
          agentId: agentId,
          listingId: listingId,
          tenantName:
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
            "User",
          agentName: listing?.agent?.name || convData?.agentName || "Agent",
          tenantImage: currentUser.avatarUrl || "",
          agentImage: agentImage,
          listingTitle: listingTitle,
          listingImage: listingImage,
          listingPrice: listingPrice,
          status: "inquiry",
          updatedAt: serverTimestamp(),
          lastMessage: lastMsg,
          unreadCount_tenant: currentUser.role === "tenant" ? 0 : 1,
          unreadCount_agent: currentUser.role === "agent" ? 0 : 1,
        });

        // increment inquiry count
        try {
          // refresh token before updating related listing doc
          try {
            await ensureFreshAuth();
          } catch (e) {
            console.warn("ensureFreshAuth before listing update failed", e);
          }
          if (listingId && listingId !== "unknown") {
            const listingDocRef = doc(db, "listings", listingId);
            await setDoc(
              listingDocRef,
              {
                inquiryCount: increment(1),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }
        } catch (e) {
          // ignore listing update errors
        }
      }
    } else {
      try {
        await ensureFreshAuth();
      } catch (e) {
        console.warn("ensureFreshAuth before conversation update failed", e);
      }
      await updateDoc(convRef, {
        lastMessage: lastMsg,
        updatedAt: serverTimestamp(),
        [currentUser.role === "tenant"
          ? "unreadCount_agent"
          : "unreadCount_tenant"]: increment(1),
      }).catch((err) =>
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `conversations/${conversationId}`,
        ),
      );
    }
  };

  const sendTextMessage = async (text) => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    setError(null);

    try {
      await ensureConversationExists(text.trim());

      const agentId = listing?.agent?.id || convData?.agentId || "unknown";
      const tenantId =
        convData?.tenantId ||
        (currentUser.role === "tenant"
          ? currentUser.id
          : conversationId.split("_")[0]);

      // Debug info to help rules troubleshooting
      console.log("sendTextMessage debug", {
        uid: currentUser.id,
        conversationId,
        tenantId,
        agentId,
      });
      const senderUid = auth?.currentUser?.uid || currentUser.id;
      const textPayload = {
        content: text.trim(),
        senderId: senderUid,
        tenantId: tenantId,
        agentId: agentId,
        type: "text",
        createdAt: serverTimestamp(),
      };
      console.log(
        "writing message payload",
        textPayload,
        "authUid=",
        auth?.currentUser?.uid,
      );
      try {
        const convSnap = await getDoc(doc(db, "conversations", conversationId));
        console.log(
          "conversation doc exists:",
          convSnap.exists(),
          "data:",
          convSnap.exists() ? convSnap.data() : null,
        );
      } catch (e) {
        console.warn("conv fetch failed", e);
      }

      try {
        await ensureFreshAuth();
        await addDocWithRetry(
          collection(db, "conversations", conversationId, "messages"),
          textPayload,
        );
      } catch (err) {
        console.error("sendText addDoc failed", err?.code, err?.message, err);
        throw err;
      }

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(
          recipientId,
          `New message from ${`${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "User"}`,
          text.trim(),
          "message",
          "chat",
          conversationId,
        );
      }

      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const pickImage = async () => {
    try {
      // Ask for permission if needed
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== "granted") {
        Alert.alert(
          "Permission required",
          "Permission to access photos is required to attach images.",
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (res.cancelled || res.canceled) return;
      const uri = res.assets?.[0]?.uri || res.uri;
      if (!uri) return;
      setIsSending(true);
      const blob = await uriToBlob(uri);
      const filename =
        res.assets?.[0]?.fileName ||
        uri.split("/").pop() ||
        `photo_${Date.now()}`;
      const path = `conversations/${conversationId}/attachments/${currentUser.id}/${Date.now()}_${filename}`;
      console.log("uploading image to", path, "uid=", currentUser.id);
      const url = await uploadFile(blob, path);

      await ensureConversationExists("[Image]");
      const senderUidImg = auth?.currentUser?.uid || currentUser.id;
      const imgPayload = {
        content: filename || "Image",
        fileUrl: url,
        fileType: "image",
        senderId: senderUidImg,
        tenantId:
          convData?.tenantId ||
          (currentUser.role === "tenant"
            ? currentUser.id
            : conversationId.split("_")[0]),
        agentId: listing?.agent?.id || convData?.agentId || "unknown",
        type: "image",
        createdAt: serverTimestamp(),
      };
      console.log(
        "writing image message payload",
        imgPayload,
        "authUid=",
        auth?.currentUser?.uid,
      );
      try {
        await ensureFreshAuth();
        await addDocWithRetry(
          collection(db, "conversations", conversationId, "messages"),
          imgPayload,
        );
      } catch (err) {
        console.error("add image message failed", err?.code, err?.message, err);
        throw err;
      }
    } catch (err) {
      console.error("Image attach error:", err);
      setError("Failed to attach image.");
    } finally {
      setIsSending(false);
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (!res || res.type === "cancel") return;
      const uri = res.uri;
      if (!uri) return;
      setIsSending(true);
      const blob = await uriToBlob(uri);
      const filename = res.name || `file_${Date.now()}`;
      const mimeType = res.mimeType || "application/octet-stream";
      const path = `conversations/${conversationId}/attachments/${currentUser.id}/${Date.now()}_${filename}`;
      console.log("uploading document to", path, "uid=", currentUser.id);
      const url = await uploadFile(blob, path);

      await ensureConversationExists("[Attachment]");
      const senderUidDoc = auth?.currentUser?.uid || currentUser.id;
      const docPayload = {
        content: filename || "Attachment",
        fileUrl: url,
        fileType: mimeType || "file",
        senderId: senderUidDoc,
        tenantId:
          convData?.tenantId ||
          (currentUser.role === "tenant"
            ? currentUser.id
            : conversationId.split("_")[0]),
        agentId: listing?.agent?.id || convData?.agentId || "unknown",
        type: "file",
        createdAt: serverTimestamp(),
      };
      console.log(
        "writing document message payload",
        docPayload,
        "authUid=",
        auth?.currentUser?.uid,
      );
      try {
        await ensureFreshAuth();
        await addDocWithRetry(
          collection(db, "conversations", conversationId, "messages"),
          docPayload,
        );
      } catch (err) {
        console.error(
          "add document message failed",
          err?.code,
          err?.message,
          err,
        );
        throw err;
      }
    } catch (err) {
      console.error("Document attach error:", err);
      setError("Failed to attach document.");
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY,
      );
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error("Start recording error", err);
      Alert.alert("Recording error", "Unable to start recording.");
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

      if (!uri) {
        setError("Recording failed.");
        return;
      }
    } catch (err) {
      console.error("Stop recording error (stop)", err);
      Alert.alert("Recording error", "Unable to stop recording.");
      setIsRecording(false);
      return;
    }

    setIsSending(true);

    // 1) Upload audio to Storage
    let url;
    try {
      // Ensure auth and UID are available before uploading
      console.log(
        "auth.currentUser:",
        auth?.currentUser?.uid,
        "prop currentUser.id:",
        currentUser?.id,
      );
      if (!currentUser || !currentUser.id || !auth?.currentUser) {
        throw new Error("User not authenticated when attempting upload");
      }
      const blob = await uriToBlob(uri);
      const path = `conversations/${conversationId}/attachments/${currentUser.id}/audio_${Date.now()}.m4a`;
      console.log("uploading audio to", path, "uid=", currentUser.id);
      url = await uploadFile(blob, path);
    } catch (err) {
      console.error(
        "Stop recording error (upload)",
        err,
        "auth.currentUser:",
        auth?.currentUser,
      );
      // Storage permission errors have different codes (storage/...). Inform user
      Alert.alert(
        "Upload failed",
        `Unable to upload audio. ${(err && (err.code || err.message)) || String(err)}`,
      );
      setIsSending(false);
      return;
    }

    // 2) Ensure conversation exists
    try {
      await ensureConversationExists("[Voice Note]");
    } catch (err) {
      console.error("Stop recording error (ensureConversation)", err);
      if (err?.code === "permission-denied") {
        Alert.alert(
          "Permission denied",
          "You do not have permission to create or update this conversation. Please check your account or backend rules.",
        );
      } else {
        Alert.alert(
          "Conversation error",
          "Unable to create or update conversation.",
        );
      }
      setIsSending(false);
      return;
    }

    // 3) Add message document
    try {
      const agentId = listing?.agent?.id || convData?.agentId || "unknown";
      const tenantId =
        convData?.tenantId ||
        (currentUser.role === "tenant"
          ? currentUser.id
          : conversationId.split("_")[0]);

      console.log("send voice debug", {
        uid: currentUser.id,
        conversationId,
        tenantId,
        agentId,
        fileUrl: url,
      });
      const senderUidVoice = auth?.currentUser?.uid || currentUser.id;
      const voicePayload = {
        content: "Voice note",
        fileUrl: url,
        fileType: "audio",
        senderId: senderUidVoice,
        tenantId: tenantId,
        agentId: agentId,
        type: "file",
        createdAt: serverTimestamp(),
      };
      console.log(
        "writing voice message payload",
        voicePayload,
        "authUid=",
        auth?.currentUser?.uid,
      );
      try {
        await ensureFreshAuth();
        await addDocWithRetry(
          collection(db, "conversations", conversationId, "messages"),
          voicePayload,
        );
      } catch (err) {
        console.error(
          "Stop recording error (addDoc)",
          err?.code,
          err?.message,
          err,
        );
        throw err;
      }
    } catch (err) {
      console.error("Stop recording error (addDoc)", err);
      if (err?.code === "permission-denied") {
        Alert.alert(
          "Permission denied",
          "You do not have permission to send messages in this conversation.",
        );
      } else {
        Alert.alert("Send failed", "Unable to send voice note.");
      }
      setIsSending(false);
      return;
    } finally {
      setIsSending(false);
    }
  };

  const emojis = ["😀", "😁", "😂", "😍", "🔥", "👍", "🙏", "🙌", "🎉", "📞"];

  const renderMessage = ({ item }) => {
    const isMine = item.senderId === currentUser.id;

    // Treat messages as audio when they have a fileUrl + fileType audio, or when type explicitly indicates audio.
    const isAudio =
      (item.type === "file" && item.fileType === "audio") ||
      item.fileType === "audio" ||
      item.type === "audio" ||
      (!!item.fileUrl &&
        /\.m4a$|\.mp3$|audio\//i.test(item.fileUrl || item.fileType || ""));

    const isImage =
      (item.type === "file" && item.fileType === "image") ||
      item.fileType === "image" ||
      item.type === "image";

    if (item.type === "action") {
      return (
        <View style={styles.centerMessage}>
          <Text style={styles.actionTitle}>Update</Text>
          <Text style={styles.actionContent}>{`"${item.content}"`}</Text>
        </View>
      );
    }

    if (isImage) {
      return (
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <Image
            source={{ uri: item.fileUrl }}
            style={styles.imageAttachment}
          />
        </View>
      );
    }

    if (isAudio) {
      return (
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <View style={styles.audioContainer}>
            <TouchableOpacity
              onPress={() => playVoiceMessage(item)}
              style={styles.audioButton}
              hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
              accessibilityRole="button"
              accessibilityLabel={
                playingMessageId === item.id && playbackStatus.isPlaying
                  ? "Pause voice note"
                  : "Play voice note"
              }
            >
              <Text style={styles.audioText}>
                {playingMessageId === item.id && playbackStatus.isPlaying
                  ? "⏸"
                  : "▶"}
              </Text>
            </TouchableOpacity>

            <View style={styles.progressWrap}>
              <TouchableOpacity
                activeOpacity={1}
                onLayout={(ev) => {
                  progressWidthRef.current[item.id] =
                    ev.nativeEvent.layout.width;
                }}
                onPress={(e) => {
                  const width =
                    progressWidthRef.current[item.id] ||
                    e.nativeEvent.layout?.width ||
                    1;
                  const x = e.nativeEvent.locationX;
                  seekInCurrent(item, x, width);
                }}
              >
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${playingMessageId === item.id && playbackStatus.durationMillis ? Math.max(0, playbackStatus.positionMillis / playbackStatus.durationMillis) * 100 : 0}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>

              <View style={styles.audioTimesRow}>
                <Text style={styles.audioMeta}>
                  {formatTime(
                    playingMessageId === item.id
                      ? playbackStatus.positionMillis
                      : 0,
                  )}
                </Text>
                <Text style={styles.audioMeta}>
                  {formatTime(
                    playingMessageId === item.id
                      ? playbackStatus.durationMillis
                      : 0,
                  )}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={changePlaybackRate}
              style={styles.rateButton}
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            >
              <Text style={styles.rateText}>
                {(playingMessageId === item.id ? playbackStatus.rate : 1)
                  .toFixed(2)
                  .replace(".00", "")}
                x
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Generic file/attachment (non-audio/image)
    if (item.type === "file" || item.fileUrl) {
      return (
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <TouchableOpacity onPress={() => openUrl(item.fileUrl)}>
            <Text style={styles.fileText}>{item.content || "Attachment"}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Fallback: plain text
    return (
      <View
        style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft]}
      >
        <Text style={isMine ? styles.bubbleTextRight : styles.bubbleTextLeft}>
          {item.content}
        </Text>
      </View>
    );
  };

  // Playback speed toggle (hoisted function so renderMessage can call it safely)
  async function changePlaybackRate() {
    try {
      const rates = [1.0, 1.5, 2.0, 0.75];
      const currentRate = playbackStatus?.rate || 1.0;
      const idx =
        rates.indexOf(currentRate) >= 0 ? rates.indexOf(currentRate) : 0;
      const next = rates[(idx + 1) % rates.length];
      setPlaybackStatus((p) => ({ ...p, rate: next }));
      if (
        soundRef.current &&
        typeof soundRef.current.setRateAsync === "function"
      ) {
        try {
          await soundRef.current.setRateAsync(next, true);
        } catch (e) {
          console.warn("setRate failed", e);
        }
      }
    } catch (e) {
      console.warn("changePlaybackRate error", e);
    }
  }

  const seekInCurrent = async (message, locationX, width) => {
    if (!soundRef.current || !width) return;
    const ratio = Math.max(0, Math.min(1, locationX / width));
    const duration = playbackStatus.durationMillis || 0;
    const pos = Math.floor(duration * ratio);
    try {
      await soundRef.current.setPositionAsync(pos);
    } catch (e) {
      console.warn("seek failed", e);
    }
  };

  // Deprecated single-use helper kept for compatibility — prefer the new per-message controls.
  const playRemoteAudio = async (url) => {
    try {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        setPlaybackStatus((p) => ({
          ...p,
          positionMillis: status.positionMillis || 0,
          durationMillis: status.durationMillis || 0,
          isPlaying: status.isPlaying || false,
          rate: status.rate || 1.0,
        }));
        if (status.didJustFinish) {
          try {
            soundRef.current && soundRef.current.unloadAsync();
          } catch (e) {}
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Play audio error", err);
      Alert.alert("Playback error", "Unable to play audio");
    }
  };

  // Format milliseconds to M:SS
  const formatTime = (ms) => {
    if (!ms || ms <= 0) return "0:00";
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  // Unified playback controls for voice messages (single active player)
  const onPlaybackStatusUpdate = (status) => {
    if (!status) return;
    setPlaybackStatus({
      positionMillis: status.positionMillis || 0,
      durationMillis: status.durationMillis || 0,
      isPlaying: status.isPlaying || false,
      rate: status.rate || 1.0,
    });
    if (status.didJustFinish) {
      setPlayingMessageId(null);
      if (soundRef.current) {
        try {
          soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
    }
  };

  const playVoiceMessage = async (message) => {
    // simple, non-native-routed playback suitable for Expo Go
    try {
      // If already playing this message, toggle pause/play
      if (playingMessageId === message.id) {
        if (playbackStatus.isPlaying) {
          await soundRef.current?.pauseAsync();
        } else {
          await soundRef.current?.playAsync();
        }
        return;
      }

      // Prevent re-entrant attempts while one is starting
      if (playLockRef.current) return;
      playLockRef.current = true;

      // Stop any existing sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn("unload prior sound failed", e);
        }
        soundRef.current = null;
      }

      setPlayingMessageId(message.id);
      setPlaybackStatus((p) => ({
        ...p,
        positionMillis: 0,
        durationMillis: 0,
        isPlaying: false,
      }));

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          shouldDuckAndroid: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
        });
      } catch (modeErr) {
        console.warn("setAudioModeAsync failed", modeErr);
      }

      let lastError = null;

      const createAndPlay = async (uri) => {
        try {
          // Create the sound without auto-playing, then start it explicitly.
          // Some streaming sources report isLoaded but not isPlaying immediately
          // which previously caused a false-negative and triggered the download fallback.
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            {
              shouldPlay: false,
              rate: playbackStatus.rate || 1.0,
              shouldCorrectPitch: true,
              volume: 1.0,
              isMuted: false,
            },
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
              try {
                soundRef.current && soundRef.current.unloadAsync();
              } catch (e) {}
              soundRef.current = null;
            }
          });

          // Attempt to start playback explicitly. If playAsync fails, we still
          // inspect the status below and return success only when actually playing.
          try {
            await soundRef.current.playAsync();
          } catch (playErr) {
            console.warn("playAsync failed, will inspect status", playErr);
          }

          const s = await soundRef.current.getStatusAsync();
          console.log("createAndPlay status", s);
          return !!(s.isLoaded && s.isPlaying);
        } catch (e) {
          lastError = e;
          console.warn("createAndPlay failed", e);
          try {
            if (soundRef.current) {
              await soundRef.current.unloadAsync();
              soundRef.current = null;
            }
          } catch (u) {}
          return false;
        }
      };

      // Try streaming playback
      let ok = await createAndPlay(message.fileUrl);

      // If streaming failed, try download to cache and play locally (works around some streaming restrictions)
      if (!ok) {
        try {
          const extMatch = (message.fileUrl || "")
            .split("?")[0]
            .split(".")
            .pop();
          const ext = extMatch && extMatch.length <= 6 ? extMatch : "m4a";
          const localPath = `${FileSystem.cacheDirectory}chat_audio_${message.id || Date.now()}.${ext}`;
          console.log("Attempting cache download", localPath);
          try {
            const dl = await FileSystem.downloadAsync(
              message.fileUrl,
              localPath,
            );
            console.log("download result", dl);
            if (dl && dl.status === 200 && dl.uri) {
              ok = await createAndPlay(dl.uri);
            } else {
              console.warn("download did not return 200", dl?.status);
              lastError = new Error("download failed " + dl?.status);
            }
          } catch (dlErr) {
            console.warn("download attempt failed", dlErr);
            lastError = dlErr;
          }
        } catch (e) {
          console.warn("cache download wrapper failed", e);
          lastError = e;
        }
      }

      if (!ok) {
        console.error("Playback failed after retries", {
          lastError,
          platform: Platform.OS,
          url: message.fileUrl,
        });
        Alert.alert("Playback error", "Unable to play audio");
        setPlayingMessageId(null);
      }

      playLockRef.current = false;
    } catch (err) {
      console.error("Play audio error (outer)", err);
      Alert.alert("Playback error", "Unable to play audio");
      setPlayingMessageId(null);
      playLockRef.current = false;
    }
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        try {
          soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
    };
  }, []);

  const handleMakePayment = () => {
    const url = listing?.paymentLink || convData?.paymentLink;
    if (url) {
      openUrl(url);
    } else {
      Alert.alert(
        "No payment link",
        "This listing does not have a payment link. Please contact the agent.",
      );
    }
  };

  // Report the listing by creating a reports document. Firestore rules require reporterId == request.auth.uid
  const handleReport = async () => {
    try {
      const reportPayload = {
        reporterId: currentUser.id,
        listingId: listing?.id || convData?.listingId || null,
        targetId: listing?.agent?.id || convData?.agentId || null,
        reason: "Reported from chat",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "reports"), reportPayload);
      Alert.alert("Reported", "Thank you — we will review this listing.");
    } catch (err) {
      console.error("Report failed", err);
      Alert.alert("Error", "Unable to send report.");
    }
  };

  async function ensureFreshAuth() {
    try {
      if (!auth || !auth.currentUser) {
        throw new Error("No authenticated user");
      }
      // Force refresh token to ensure request.auth is valid in rules
      if (typeof auth.currentUser.getIdToken === "function") {
        await auth.currentUser.getIdToken(true);
      }
      return auth.currentUser.uid;
    } catch (e) {
      console.error("ensureFreshAuth failed", e);
      throw e;
    }
  }

  // Wrapper to add a document with a single retry after forcing token refresh on permission errors
  const addDocWithRetry = async (ref, payload, retries = 1) => {
    try {
      return await addDoc(ref, payload);
    } catch (err) {
      console.error("addDoc failed", err?.code, err?.message);
      const isAuthError =
        err?.code === "permission-denied" ||
        err?.code === "unauthenticated" ||
        err?.code === "failed-precondition";
      if (isAuthError && retries > 0) {
        try {
          await ensureFreshAuth();
        } catch (e) {
          console.warn("ensureFreshAuth during retry failed", e);
        }
        // small delay to allow token propagation
        await new Promise((res) => setTimeout(res, 500));
        return addDocWithRetry(ref, payload, retries - 1);
      }
      throw err;
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                {otherUser?.avatarUrl ? (
                  <Image
                    source={{ uri: otherUser.avatarUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {(otherUser?.name || listing?.agent?.name || "A").charAt(0)}
                  </Text>
                )}
              </View>
              <View>
                <Text style={styles.title}>
                  {otherUser?.name || listing?.agent?.name}
                </Text>
                <Text style={styles.status}>Active</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close chat"
            >
              <X
                width={20}
                height={20}
                strokeWidth={2.5}
                color={Platform.OS === "ios" ? "#007aff" : "#111"}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.reference}>
            <Image
              source={{ uri: listing?.image || convData?.listingImage }}
              style={styles.refImage}
            />
            <View style={styles.refMeta}>
              <Text style={styles.refLabel}>Inquiry</Text>
              <Text style={styles.refTitle} numberOfLines={1}>
                {listing?.title || convData?.listingTitle}
              </Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceText}>
                {listing?.price || convData?.listingPrice}
              </Text>
            </View>
          </View>
          {/* Action buttons for payment and reporting */}
          {currentUser?.role !== "agent" && (
            <View style={styles.refActions}>
              <TouchableOpacity
                onPress={handleMakePayment}
                style={[styles.refActionButton, styles.refActionPrimary]}
              >
                <Text
                  style={[styles.refActionText, styles.refActionPrimaryText]}
                >
                  Make Payment
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReport}
                style={styles.refActionButton}
              >
                <Text style={styles.refActionText}>Report</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.messagesWrap}>
            {isLoading ? (
              <ActivityIndicator size="large" />
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item, index) => item?.id || index.toString()}
                contentContainerStyle={{ padding: 12 }}
              />
            )}
          </View>

          <View style={styles.inputArea}>
            <View style={styles.inputRow}>
              {/* Attachment (document) icon kept, photo removed per request */}
              <TouchableOpacity
                onPress={pickDocument}
                style={styles.iconButton}
              >
                <Text>📎</Text>
              </TouchableOpacity>
              {/* Emoji toggle */}
              <TouchableOpacity
                onPress={() => setEmojiVisible((v) => !v)}
                style={styles.iconButton}
              >
                <Text>😊</Text>
              </TouchableOpacity>

              {/* Emoji tray */}
              {emojiVisible && (
                <View style={styles.emojiTrayWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiTray}
                  >
                    {emojis.map((e) => (
                      <TouchableOpacity
                        key={e}
                        onPress={() => {
                          setNewMessage((s) => s + e);
                          setEmojiVisible(false);
                        }}
                        style={styles.emojiButton}
                      >
                        <Text style={styles.emojiText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                style={styles.textInput}
                editable={!isSending}
              />

              <View style={styles.sendGroup}>
                <TouchableOpacity
                  onPress={isRecording ? stopRecordingAndSend : startRecording}
                  style={[
                    styles.voiceButton,
                    isRecording && styles.voiceRecording,
                  ]}
                >
                  <Text style={styles.voiceIcon}>
                    {isRecording ? "■" : "🎙"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => sendTextMessage(newMessage)}
                  disabled={!newMessage.trim() || isSending}
                  style={[
                    styles.sendButton,
                    (!newMessage.trim() || isSending) && styles.sendDisabled,
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.sendIcon}>➤</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.toolsRow}>
              <Text style={styles.secureLabel}>
                🔒DISCLAIMER:CONVERSAION IS BEING MONITOR FOR RECORD PURPOSIE
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0f7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 10 },
  avatarText: { fontWeight: "700" },
  title: { fontWeight: "700" },
  status: { fontSize: 12, color: "#666" },
  closeButton: { padding: 8 },
  closeText: { color: "#007aff" },
  reference: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#f4f4f4",
  },
  refImage: { width: 56, height: 56, borderRadius: 8, marginRight: 10 },
  refMeta: { flex: 1 },
  refLabel: {
    fontSize: 10,
    color: "#888",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  refTitle: { fontWeight: "700" },
  priceBox: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  priceText: { color: "#059669", fontWeight: "700" },
  messagesWrap: { flex: 1, backgroundColor: "#f8fafc" },
  bubble: { padding: 10, marginVertical: 6, borderRadius: 12, maxWidth: "80%" },
  bubbleLeft: { backgroundColor: "#fff", alignSelf: "flex-start" },
  bubbleRight: { backgroundColor: "#059669", alignSelf: "flex-end" },
  bubbleTextLeft: { color: "#111" },
  bubbleTextRight: { color: "#fff" },
  centerMessage: {
    alignSelf: "center",
    padding: 10,
    backgroundColor: "#eef2ff",
    borderRadius: 12,
    marginVertical: 8,
  },
  actionTitle: {
    fontWeight: "800",
    color: "#4f46e5",
    textTransform: "uppercase",
    fontSize: 12,
  },
  actionContent: { marginTop: 6, color: "#1f2937" },
  imageAttachment: { width: 200, height: 120, borderRadius: 8 },
  audioButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  audioText: { fontSize: 20, color: "#111", fontWeight: "700" },
  fileText: { color: "#111", textDecorationLine: "underline" },
  inputArea: {
    borderTopWidth: 1,
    borderColor: "#eee",
    padding: 8,
    backgroundColor: "#fff",
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  iconButton: { padding: 8 },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eee",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  sendButton: {
    backgroundColor: "#059669",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendDisabled: { backgroundColor: "#cbd5e1" },
  sendIcon: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sendGroup: { flexDirection: "row", alignItems: "center" },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  voiceRecording: { backgroundColor: "#fee2e2", borderColor: "#f44336" },
  voiceIcon: { fontSize: 18, color: "#111" },
  emojiTrayWrap: { position: "absolute", left: 12, right: 100, bottom: 62 },
  emojiTray: { paddingVertical: 6, paddingHorizontal: 8, alignItems: "center" },
  emojiButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  emojiText: { fontSize: 20 },
  toolsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  recordButton: { padding: 6 },
  secureLabel: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    alignSelf: "center",
  },
  refActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#f4f4f4",
  },
  refActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  refActionPrimary: { backgroundColor: "#059669" },
  refActionText: { color: "#111", fontWeight: "700" },
  refActionPrimaryText: { color: "#fff" },
  audioContainer: { flexDirection: "row", alignItems: "center" },
  progressWrap: { flex: 1, marginHorizontal: 12, paddingVertical: 6 },
  progressBarBackground: {
    height: 12,
    backgroundColor: "#e6e6e6",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressBarFill: { height: 12, backgroundColor: "#059669" },
  audioMeta: { fontSize: 12, color: "#6b7280" },
  audioTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rateButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginLeft: 8,
  },
  rateText: { fontSize: 13, color: "#111", fontWeight: "600" },
});

export default ChatModal;
