import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Platform,
  Linking,
  Dimensions,
  SafeAreaView,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import {
  X,
  Send,
  User,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Paperclip,
  Mic,
  FileText,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
  Play,
  Pause,
  Volume2,
  Trash2,
  Calendar,
  CalendarPlus,
  CalendarRange,
  Clock,
  Download,
} from "lucide-react-native";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import SafeImage from "./safeimage";
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
import { useAuth } from "../context/AuthContext";
import VerificationBadge from "./verificationbadge";
import { createNotification } from "../lib/notifications";
import { calculateVerificationLevel } from "../lib/verification";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { storage } from "../lib/firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import * as DocumentPicker from "expo-document-picker";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Native Simulated Audio Player Component
const audioCache = {}; // in-memory store base64 -> { sound, uri }

const AudioPlayer = ({ src, isOwn, duration: propDuration }) => {
  // Voice notes removed - render a simple placeholder so the rest of the chat stays functional
  return (
    <View
      style={[
        styles.audioContainer,
        isOwn ? styles.audioOwn : styles.audioOther,
      ]}
    >
      <Text style={styles.textMuted}>Voice messages disabled</Text>
    </View>
  );
};

const ChatModal = ({
  isOpen,
  onClose,
  listing,
  currentUser,
  overrideConversationId,
}) => {
  const { setSelectedAgentId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerLevels, setVisualizerLevels] = useState(
    new Array(20).fill(4),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [convStatus, setConvStatus] = useState("inquiry");
  const [convData, setConvData] = useState(null);
  const [error, setError] = useState(null);
  const [showWhatsAppDisclaimer, setShowWhatsAppDisclaimer] = useState(false);
  const [showPrivacyBanner, setShowPrivacyBanner] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [cachedPrice, setCachedPrice] = useState(0);
  // Tour / calendar UI state (added incrementally)
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [tourTime, setTourTime] = useState("");
  const [tourMessage, setTourMessage] = useState("");
  const [tourLocation, setTourLocation] = useState("");

  // helper: parse a price value (number or string) into a numeric amount
  const parsePrice = (p) => {
    if (p == null) return 0;
    if (typeof p === "number") return p;
    try {
      const s = String(p);
      const num = parseFloat(s.replace(/[^0-9.]/g, ""));
      return isNaN(num) ? 0 : num;
    } catch (e) {
      return 0;
    }
  };

  // helper: format currency values consistently (fallback to #0.00)
  const formatCurrency = (n) => {
    const val = Number(n) || 0;
    try {
      return `#${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (e) {
      return `#${val.toFixed(2)}`;
    }
  };

  // Payment helpers: parse listing price and format currency
  useEffect(() => {
    const currentPrice = listing?.price || listing?.rent;
    if (currentPrice) {
      const parsed = parsePrice(currentPrice);
      if (parsed !== cachedPrice) {
        setCachedPrice(parsed);
      }
    }
  }, [listing]); // Only runs when listing changes

  // 3. apartmentFee now just returns the state value
  const apartmentFee = cachedPrice;

  // 4. Calculate total (this will now always have a value)
  const serviceFee = 300;
  const total = Math.round(apartmentFee + serviceFee);

  const flatListRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const recordingRef = useRef(null);

  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleShow = (e) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardOffset(height);
      // ensure messages scroll into view when keyboard opens
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        50,
      );
    };

    const handleHide = () => setKeyboardOffset(0);

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // helper to write base64 data to a temporary file using FileSystem if available
  const writeBase64ToFile = async (base64Data) => {
    try {
      const filename = `${FileSystem.cacheDirectory}audio_${Date.now()}.m4a`;
      const base64 = base64Data.split(",")[1] || base64Data;
      await FileSystem.writeAsStringAsync(filename, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri: filename };
    } catch (e) {
      return { uri: null };
    }
  };

  // helper to read a file as base64 with a safe fallback for EncodingType
  const readFileAsBase64 = async (uri) => {
    try {
      const reader =
        (FileSystemLegacy && FileSystemLegacy.readAsStringAsync) ||
        FileSystem.readAsStringAsync;
      const encoding =
        (FileSystem.EncodingType && FileSystem.EncodingType.Base64) || "base64";
      return await reader(uri, { encoding });
    } catch (e) {
      // final fallback: try literal 'base64' with whatever reader is available
      try {
        const reader =
          (FileSystemLegacy && FileSystemLegacy.readAsStringAsync) ||
          FileSystem.readAsStringAsync;
        return await reader(uri, { encoding: "base64" });
      } catch (err) {
        console.error("readFileAsBase64 failed", err);
        throw err;
      }
    }
  };

  // Upload a local file URI (file://...) to Firebase Storage and return download URL + storage path
  const uploadFileUriToStorage = async (fileUri) => {
    try {
      // fetch file as blob
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const path = `audio_messages/${conversationId}/${Date.now()}_voice.m4a`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, blob);
      const url = await getDownloadURL(sRef);

      return { url, path, localUri: fileUri };
    } catch (e) {
      console.error("uploadFileUriToStorage error", e);
      return { url: null, path: null };
    }
  };

  // Generic file URI uploader (documents, images, etc.)
  const uploadUriToStorage = async (uri, folder = "documents") => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const rawName = (uri || "").split("/").pop() || `file_${Date.now()}`;
      const safeName = rawName.split("?")[0];
      const path = `${folder}/${conversationId}/${Date.now()}_${safeName}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, blob);
      const url = await getDownloadURL(sRef);
      return { url, path };
    } catch (err) {
      console.error("uploadUriToStorage error", err);
      return { url: null, path: null };
    }
  };

  // Download a remote URL to a local temp file for playback and return local uri
  const downloadUrlToFile = async (url) => {
    try {
      // On web platforms we can use the remote URL directly (no file download available)
      if (Platform && Platform.OS === "web") {
        return url;
      }

      const filename = `${FileSystem.cacheDirectory}dl_${Date.now()}.m4a`;
      const { uri } = await FileSystem.downloadAsync(url, filename);
      return uri;
    } catch (e) {
      console.error("downloadUrlToFile error", e);
      // If download failed, as a safe fallback return the remote URL so browsers can still play it
      return url;
    }
  };

  // Calendar helpers: create Google Calendar URL and ICS content (incremental)
  const getGoogleCalendarUrl = ({ title, description, start, end, location }) => {
    const fmtDate = (d) => (new Date(d)).toISOString().replace(/-|:|\.\d+/g, "");
    const dates = `${fmtDate(start)}/${fmtDate(end)}`;
    const base = `https://calendar.google.com/calendar/render?action=TEMPLATE`;
    const params = `&text=${encodeURIComponent(title || "Tour")}&details=${encodeURIComponent(description || "")}&location=${encodeURIComponent(location || "")}&dates=${dates}`;
    return base + params;
  };

  const createIcsContent = ({ title, description, start, end, location }) => {
    const uid = `directrent-${Date.now()}@directrent.app`;
    const dtStart = (new Date(start)).toISOString().replace(/-|:|\.\d+/g, "");
    const dtEnd = (new Date(end)).toISOString().replace(/-|:|\.\d+/g, "");
    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//DirectRent//EN\nBEGIN:VEVENT\nUID:${uid}\nDTSTAMP:${dtStart}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nSUMMARY:${(title || "Tour").replace(/\n/g, " ")}\nDESCRIPTION:${(description || "").replace(/\n/g, " ")}\nLOCATION:${(location || "").replace(/\n/g, " ")}\nEND:VEVENT\nEND:VCALENDAR`;
  };

  const downloadIcsFile = async ({ title, description, start, end, location }) => {
    try {
      const ics = createIcsContent({ title, description, start, end, location });
      const filename = `${FileSystem.cacheDirectory}event_${Date.now()}.ics`;
      await FileSystem.writeAsStringAsync(filename, ics, { encoding: FileSystem.EncodingType.UTF8 });
      try { await Linking.openURL(filename); } catch(e) { console.warn('ICS open failed', e); }
      return filename;
    } catch (err) {
      console.error("downloadIcsFile error", err);
      return null;
    }
  };

  // Tour / contract handlers (incremental)
  const handleOpenRequestTour = () => {
    setTourDate("");
    setTourTime("");
    setTourMessage("");
    setTourLocation(listing?.address || "");
    setShowTourModal(true);
  };

  const handleSubmitTourRequest = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const startIso = tourDate && tourTime ? new Date(`${tourDate}T${tourTime}`).toISOString() : new Date().toISOString();
      const endIso = new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
      const content = `Tour requested: ${tourDate} ${tourTime} - ${tourMessage}`;
      const convRef = doc(db, "conversations", conversationId);
      await updateDoc(convRef, { status: "tour_requested", lastMessage: content, updatedAt: serverTimestamp(), [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1) });

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        content: content,
        senderId: currentUser.id,
        tenantId: convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]),
        agentId: convData?.agentId || listing.agent?.id || "unknown",
        type: "action",
        actionType: "tour_requested",
        meta: { start: startIso, end: endIso, location: tourLocation, message: tourMessage },
        createdAt: serverTimestamp(),
      });

      const recipientId = currentUser.role === "tenant" ? (convData?.agentId || listing.agent?.id) : convData?.tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(recipientId, `Tour Requested`, content, "message", "chat", conversationId);
      }

      setShowTourModal(false);
    } catch (err) {
      console.error("submit tour request error", err);
      setError("Failed to submit tour request.");
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmTour = async (meta) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const content = `Tour confirmed for ${(new Date(meta.start)).toLocaleString()}`;
      const convRef = doc(db, "conversations", conversationId);
      await updateDoc(convRef, { status: "tour_confirmed", lastMessage: content, updatedAt: serverTimestamp(), [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1) });

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        content: content,
        senderId: currentUser.id,
        tenantId: convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]),
        agentId: convData?.agentId || listing.agent?.id || "unknown",
        type: "action",
        actionType: "tour_confirmed",
        meta: meta,
        createdAt: serverTimestamp(),
      });

      const recipientId = currentUser.role === "tenant" ? (convData?.agentId || listing.agent?.id) : convData?.tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(recipientId, `Tour Confirmed`, content, "message", "chat", conversationId);
      }
    } catch (err) {
      console.error("confirm tour error", err);
      setError("Failed to confirm tour.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeclineTour = async (reason = "Not available") => {
    if (isSending) return;
    setIsSending(true);
    try {
      const content = `Tour declined: ${reason}`;
      const convRef = doc(db, "conversations", conversationId);
      await updateDoc(convRef, { status: "tour_declined", lastMessage: content, updatedAt: serverTimestamp(), [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1) });

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        content: content,
        senderId: currentUser.id,
        tenantId: convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]),
        agentId: convData?.agentId || listing.agent?.id || "unknown",
        type: "action",
        actionType: "tour_declined",
        createdAt: serverTimestamp(),
      });

      const recipientId = currentUser.role === "tenant" ? (convData?.agentId || listing.agent?.id) : convData?.tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(recipientId, `Tour Declined`, content, "message", "chat", conversationId);
      }
    } catch (err) {
      console.error("decline tour error", err);
      setError("Failed to decline tour.");
    } finally {
      setIsSending(false);
    }
  };

  // Contract flow handlers
  const handleSendContract = async () => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (!res || res.type === 'cancel') return;
      const uri = res.uri;
      const name = res.name || (uri && uri.split('/').pop()) || `contract_${Date.now()}`;
      const { url, path } = await uploadUriToStorage(uri, 'contracts');
      if (!url) throw new Error('Upload failed');

      const tenantId = convData?.tenantId || (currentUser.role === 'tenant' ? currentUser.id : conversationId.split('_')[0]);
      const agentId = convData?.agentId || listing.agent?.id || 'unknown';

      // Add a document message
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        content: `Contract: ${name}`,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: 'document',
        meta: { fileUrl: url, fileName: name, storagePath: path },
        createdAt: serverTimestamp(),
      });

      // Add an action message signaling contract sent
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        content: `Tenancy agreement "${name}" sent`,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: 'action',
        actionType: 'contract_sent',
        meta: { fileUrl: url, fileName: name, storagePath: path },
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        status: 'contract_sent',
        lastMessage: `Tenancy agreement "${name}" sent`,
        updatedAt: serverTimestamp(),
        [currentUser.role === 'tenant' ? 'unreadCount_agent' : 'unreadCount_tenant']: increment(1),
      });

    } catch (err) {
      console.error('handleSendContract error', err);
      setError('Failed to send contract.');
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptContract = async (msg) => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const tenantId = convData?.tenantId || (currentUser.role === 'tenant' ? currentUser.id : conversationId.split('_')[0]);
      const agentId = convData?.agentId || listing.agent?.id || 'unknown';

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        content: `Contract accepted by ${currentUser.firstName || currentUser.email || currentUser.id}`,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: 'action',
        actionType: 'contract_accepted',
        meta: { originalMessageId: msg.id, fileUrl: msg.meta?.fileUrl },
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        status: 'contract_accepted',
        lastMessage: `Contract accepted`,
        updatedAt: serverTimestamp(),
        [currentUser.role === 'tenant' ? 'unreadCount_agent' : 'unreadCount_tenant']: increment(1),
      });

      // Optionally auto open payment modal for tenant after acceptance
      if (currentUser.role === 'tenant') {
        setShowPaymentModal(true);
      }
    } catch (err) {
      console.error('handleAcceptContract error', err);
      setError('Failed to accept contract.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeclineContract = async (msg) => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const tenantId = convData?.tenantId || (currentUser.role === 'tenant' ? currentUser.id : conversationId.split('_')[0]);
      const agentId = convData?.agentId || listing.agent?.id || 'unknown';

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        content: `Contract declined by ${currentUser.firstName || currentUser.email || currentUser.id}`,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: 'action',
        actionType: 'contract_declined',
        meta: { originalMessageId: msg.id },
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        status: 'contract_declined',
        lastMessage: `Contract declined`,
        updatedAt: serverTimestamp(),
        [currentUser.role === 'tenant' ? 'unreadCount_agent' : 'unreadCount_tenant']: increment(1),
      });
    } catch (err) {
      console.error('handleDeclineContract error', err);
      setError('Failed to decline contract.');
    } finally {
      setIsSending(false);
    }
  };

  const conversationId =
    overrideConversationId ||
    (currentUser.role === "tenant"
      ? `${currentUser.id}_${listing.agent?.id || "unknown"}_${listing.id}`
      : `unknown_${currentUser.id}_${listing.id}`);

  useEffect(() => {
    if (!isOpen) return;

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
        console.error("Error resetting unread count:", err);
      }
    };
    resetUnread();

    setIsLoading(true);
    setError(null);

    const convRef = doc(db, "conversations", conversationId);
    let unsubOther;

    const unsubConv = onSnapshot(
      convRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConvStatus(data.status || "inquiry");
          setConvData(data);

          const otherId =
            currentUser.role === "tenant" ? data.agentId : data.tenantId;
          if (otherId && !unsubOther) {
            unsubOther = onSnapshot(
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

    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages",
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(msgs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Chat listener error:", err);
        handleFirestoreError(
          err,
          OperationType.LIST,
          `conversations/${conversationId}/messages`,
        );
        if (err.code === "permission-denied") {
          if (convData) {
            setError(
              "Missing permissions. Please ensure your session is active.",
            );
          }
        } else {
          setError("Failed to load messages.");
        }
        setIsLoading(false);
      },
    );

    return () => {
      unsubscribe();
      unsubConv();
      if (unsubOther) unsubOther();
    };
  }, [isOpen, conversationId, currentUser.id, currentUser.role]);

  const handleAction = async (actionType, content, nextStatus) => {
    if (isSending) return;
    setIsSending(true);
    try {
      const convRef = doc(db, "conversations", conversationId);
      const agentId = listing.agent?.id || convData?.agentId || "unknown";
      const tenantId =
        convData?.tenantId ||
        (currentUser.role === "tenant"
          ? currentUser.id
          : conversationId.split("_")[0]);

      await updateDoc(convRef, {
        status: nextStatus,
        lastMessage: content,
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

      if (nextStatus === "completed" && agentId !== "unknown") {
        const agentDocRef = doc(db, "users", agentId);
        await updateDoc(agentDocRef, {
          completedTxns: increment(1),
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `users/${agentId}`),
        );
      }

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        {
          content: content,
          senderId: currentUser.id,
          tenantId: tenantId,
          agentId: agentId,
          type: "action",
          actionType: actionType,
          createdAt: serverTimestamp(),
        },
      ).catch((err) =>
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `conversations/${conversationId}/messages`,
        ),
      );

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(
          recipientId,
          `Transaction Update: ${actionType.replace("_", " ")}`,
          content,
          "message",
          "chat",
          conversationId,
        );
      }
    } catch (err) {
      console.error("Action error:", err);
      setError("Failed to process transaction step.");
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsAppTransition = () => {
    const phoneNumber = otherUser?.phoneNumber || convData?.agentPhone;
    if (!phoneNumber) {
      setError("Agent's contact number is not available yet.");
      return;
    }
    setShowWhatsAppDisclaimer(true);
  };

  const confirmWhatsApp = () => {
    const phoneNumber = otherUser?.phoneNumber || convData?.agentPhone;
    if (!phoneNumber) return;

    let cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "234" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("234")) {
      cleanPhone = "234" + cleanPhone;
    }

    const message = encodeURIComponent(
      `Hi, I'm interested in your listing: ${listing.title} on DirectRent. Listing Ref: ${listing.id}`,
    );
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${message}`);
    setShowWhatsAppDisclaimer(false);
  };

  // Tenant-only actions: pay now and report user
  const handlePayNow = async () => {
    // initiate escrow transaction (creates transaction record and notifies counterpart)
    try {
      await handleInitiateEscrow && handleInitiateEscrow(total);
    } catch (e) {
      console.error("Pay now error", e);
      setError("Failed to initiate payment.");
    }
  };

  // Create an escrow transaction record and update conversation status
  const handleInitiateEscrow = async (amount) => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const agentId = listing.agent?.id || convData?.agentId || "unknown";
      const tenantId = convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]);

      const txRef = await addDoc(collection(db, "transactions"), {
        listingId: listing?.id || null,
        conversationId: conversationId,
        amount: amount || total,
        currency: "NGN",
        payerId: currentUser.id,
        payeeId: agentId,
        status: "locked",
        createdAt: serverTimestamp(),
      });

      // ensure id is present on doc
      await updateDoc(txRef, { id: txRef.id }).catch(() => {});

      const content = `Escrow locked for ${formatCurrency(amount || total)} (tx:${txRef.id})`;

      // create action message + update conversation status to escrow_locked
      await updateDoc(doc(db, "conversations", conversationId), {
        status: "escrow_locked",
        lastMessage: content,
        updatedAt: serverTimestamp(),
        [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1),
      });

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        content: content,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: "action",
        actionType: "escrow_locked",
        meta: { transactionId: txRef.id, amount: amount || total },
        createdAt: serverTimestamp(),
      });

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(recipientId, `Escrow Locked`, content, "transaction", "chat", conversationId);
      }

      // reflect in UI
      setPaymentConfirmed(true);
      setShowPaymentModal(false);
    } catch (err) {
      console.error("handleInitiateEscrow error", err);
      setError("Failed to lock escrow.");
    } finally {
      setIsSending(false);
    }
  };

  const handleReportUser = async () => {
    try {
      const reportedId =
        convData?.agentId ||
        listing.agent?.id ||
        (conversationId.split("_")[1] ?? "unknown");
      await addDoc(collection(db, "reports"), {
        reporterId: currentUser.id,
        reportedId: reportedId,
        conversationId: conversationId,
        listingId: listing?.id || null,
        reason: "Reported from chat modal",
        createdAt: serverTimestamp(),
      });
      setError("Report submitted. Thank you.");
      setTimeout(() => setError(null), 3500);
    } catch (err) {
      console.error("Report error", err);
      setError("Failed to submit report.");
    }
  };

  const startRecording = async () => {
    try {
      // request permissions
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone permission denied");
        return;
      }
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
      // update UI timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
        setVisualizerLevels(
          Array.from({ length: 20 }).map(() =>
            Math.max(3, Math.floor(Math.random() * 16)),
          ),
        );
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Could not access microphone.");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setVisualizerLevels(new Array(20).fill(4));

    (async () => {
      let recordedDuration = recordingTime;
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          const status = await recordingRef.current.getStatusAsync();
          recordedDuration = Math.round(
            (status.durationMillis || recordedDuration * 1000) / 1000,
          );
          const uri = recordingRef.current.getURI();
          if (uri) {
            // Read recorded file as base64 and send inline (matches web behavior)
            try {
              const base64 = await readFileAsBase64(uri);
              const dataUri = `data:audio/m4a;base64,${base64}`;
              // cache mapping so AudioPlayer can create a temp file when needed
              audioCache[dataUri] = { uri };
              if (!cancel) {
                await handleSendAudio(dataUri, recordedDuration);
              }
            } catch (e) {
              console.warn(
                "Failed to read recording as base64, attempting upload fallback",
                e,
              );
              // fallback to upload then send URL
              try {
                const uploadResult = await uploadFileUriToStorage(uri);
                if (uploadResult && uploadResult.url) {
                  audioCache[uploadResult.url] = { uri };
                  if (!cancel) {
                    await handleSendAudio(uploadResult.url, recordedDuration);
                  }
                } else {
                  if (!cancel) {
                    await handleSendAudio(uri, recordedDuration);
                  }
                }
              } catch (e2) {
                console.error("Upload fallback failed", e2);
                if (!cancel) {
                  await handleSendAudio(uri, recordedDuration);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Stop recording error", e);
        if (!cancel) {
          const uniquePlaybackId = `voice_note_${Date.now()}`;
          await handleSendAudio(uniquePlaybackId, recordedDuration);
        }
      } finally {
        recordingRef.current = null;
        setIsRecording(false);
        setRecordingTime(0);
      }
    })();
  };

  const handleSendAudio = async (source, recordedDuration = null) => {
    setIsSending(true);
    setError(null);
    try {
      let contentToStore = source;

      // If source is a local file URI or base64 data URI, upload it to Firebase Storage
      if (
        source &&
        (source.startsWith("data:audio") || source.startsWith("file://"))
      ) {
        let uploadResult = null;

        if (source.startsWith("data:audio")) {
          // already base64 data URI
          contentToStore = source;
        } else {
          // file:// URI recorded from device -> try upload
          try {
            uploadResult = await uploadFileUriToStorage(source);
          } catch (e) {
            console.warn("uploadFileUriToStorage failed", e);
            uploadResult = null;
          }

          if (uploadResult && uploadResult.url) {
            contentToStore = uploadResult.url;
            // cache local file for immediate playback if available
            if (uploadResult.localUri)
              audioCache[contentToStore] = { uri: uploadResult.localUri };
          } else {
            // Fallback: convert local file to base64 and send inline (like web)
            try {
              const base64 = await readFileAsBase64(source);
              contentToStore = `data:audio/m4a;base64,${base64}`;
              // cache mapping so AudioPlayer can create a temp file when needed
              audioCache[contentToStore] = { uri: source };
            } catch (e) {
              console.error(
                "Failed to convert audio file to base64 fallback",
                e,
              );
            }
          }
        }
      }

      const tenantId =
        convData?.tenantId ||
        (currentUser.role === "tenant"
          ? currentUser.id
          : conversationId.split("_")[0]);
      const agentId = listing.agent?.id || "unknown";

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        {
          content: contentToStore,
          senderId: currentUser.id,
          tenantId: tenantId,
          agentId: agentId,
          type: "audio",
          duration: recordedDuration,
          createdAt: serverTimestamp(),
        },
      );

      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: "Audio message",
        updatedAt: serverTimestamp(),
        [currentUser.role === "tenant"
          ? "unreadCount_agent"
          : "unreadCount_tenant"]: increment(1),
      });

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(
          recipientId,
          `New audio message from ${`${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "User"}`,
          "Audio message",
          "message",
          "chat",
          conversationId,
        );
      }
    } catch (err) {
      console.error("Audio processing/send error:", err);
      setError("Failed to send audio message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    setError(null);
    const messageContent = newMessage.trim();
    setNewMessage("");

    try {
      const convRef = doc(db, "conversations", conversationId);
      const agentId = listing.agent?.id || "unknown";

      const convDoc = await getDoc(convRef);
      if (!convDoc.exists()) {
        // compute safe fallbacks for conversation fields to avoid undefined being written
        let agentImage = "";
        if (agentId !== "unknown") {
          const agentDoc = await getDoc(doc(db, "users", agentId));
          if (agentDoc.exists()) {
            agentImage = agentDoc.data().avatarUrl || "";
          }
        }

        const safeListingId = listing?.id
          ? String(listing.id)
          : conversationId.split("_")[2] || null;
        const safeListingTitle =
          listing?.title || (convData && convData.listingTitle) || "";
        const safeListingImage =
          listing?.image || (convData && convData.listingImage) || "";
        const safeListingPrice =
          listing?.price != null
            ? listing.price
            : convData && convData.listingPrice != null
              ? convData.listingPrice
              : null;

        await setDoc(convRef, {
          id: conversationId,
          tenantId: currentUser.id,
          agentId: agentId,
          listingId: safeListingId,
          tenantName:
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
            "User",
          agentName: safeListingTitle
            ? listing?.agent?.name || convData?.agentName || "Agent"
            : listing?.agent?.name || convData?.agentName || "Agent",
          tenantImage: currentUser.avatarUrl || "",
          agentImage: agentImage || (convData && convData.agentImage) || "",
          listingTitle: safeListingTitle,
          listingImage: safeListingImage,
          listingPrice: safeListingPrice,
          status: "inquiry",
          updatedAt: serverTimestamp(),
          lastMessage: messageContent,
          unreadCount_tenant: currentUser.role === "tenant" ? 0 : 1,
          unreadCount_agent: currentUser.role === "agent" ? 0 : 1,
        });

        const listingDocRef = doc(db, "listings", listing.id.toString());
        await setDoc(
          listingDocRef,
          {
            inquiryCount: increment(1),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await updateDoc(convRef, {
          lastMessage: messageContent,
          updatedAt: serverTimestamp(),
          [currentUser.role === "tenant"
            ? "unreadCount_agent"
            : "unreadCount_tenant"]: increment(1),
        });
      }

      const tenantId =
        convData?.tenantId ||
        (currentUser.role === "tenant"
          ? currentUser.id
          : conversationId.split("_")[0]);

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        {
          content: messageContent,
          senderId: currentUser.id,
          tenantId: tenantId,
          agentId: agentId,
          type: "text",
          createdAt: serverTimestamp(),
        },
      );

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(
          recipientId,
          `New message from ${`${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "User"}`,
          messageContent,
          "message",
          "chat",
          conversationId,
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  // Document send handler (used by the paperclip button)
  const handleSendDocument = async () => {
    if (isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!res || res.type === "cancel") return;
      const uri = res.uri;
      const name = res.name || (uri && uri.split("/").pop()) || `file_${Date.now()}`;

      const { url, path } = await uploadUriToStorage(uri, "documents");
      if (!url) throw new Error("Upload failed");

      const tenantId =
        convData?.tenantId || (currentUser.role === "tenant" ? currentUser.id : conversationId.split("_")[0]);
      const agentId = convData?.agentId || listing.agent?.id || "unknown";

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        content: name,
        senderId: currentUser.id,
        tenantId: tenantId,
        agentId: agentId,
        type: "document",
        meta: { fileUrl: url, fileName: name, storagePath: path },
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: `File: ${name}`,
        updatedAt: serverTimestamp(),
        [currentUser.role === "tenant" ? "unreadCount_agent" : "unreadCount_tenant"]: increment(1),
      });

      const recipientId = currentUser.role === "tenant" ? agentId : tenantId;
      if (recipientId && recipientId !== "unknown") {
        await createNotification(
          recipientId,
          `File shared`,
          `${(currentUser.firstName || "").trim()} shared ${name}`,
          "message",
          "chat",
          conversationId,
        );
      }
    } catch (err) {
      console.error("handleSendDocument error", err);
      setError("Failed to upload document.");
    } finally {
      setIsSending(false);
    }
  };

  const renderMessageItem = ({ item: msg }) => {
    if (msg.type === "action") {
      // Render contract card when contract is sent
      if (msg.actionType === "contract_sent") {
        const fileUrl = msg.meta?.fileUrl || msg.fileUrl;
        const fileName = msg.meta?.fileName || msg.fileName || "Contract";
        return (
          <View style={styles.actionMessageContainer}>
            <View style={styles.actionIconWrapper}>
              <FileText size={18} color="#4f46e5" />
            </View>
            <Text style={styles.actionUpdateLabel}>Contract</Text>
            <Text style={styles.actionContentText}>{fileName}</Text>
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.actionBtnSecondary, { marginRight: 8 }]}
                onPress={() => {
                  if (fileUrl) Linking.openURL(fileUrl);
                }}
              >
                <Text style={styles.actionBtnSecondaryText}>Open Contract</Text>
              </TouchableOpacity>

              {currentUser.role === "tenant" && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtnSolidPrimary, { marginRight: 8 }]}
                    onPress={() => handleAcceptContract(msg)}
                  >
                    <Text style={styles.actionBtnSolidPrimaryText}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSolidSuccess}
                    onPress={() => handleDeclineContract(msg)}
                  >
                    <Text style={styles.actionBtnSolidSuccessText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={styles.actionBlockFooter}>Verified Property Block</Text>
          </View>
        );
      }

      // Default action render
      return (
        <View style={styles.actionMessageContainer}>
          <View style={styles.actionIconWrapper}>
            {msg.actionType === "paid" ? (
              <CreditCard size={18} color="#4f46e5" />
            ) : (
              <FileText size={18} color="#4f46e5" />
            )}
          </View>
          <Text style={styles.actionUpdateLabel}>Update</Text>
          <Text style={styles.actionContentText}>"{msg.content}"</Text>
          <Text style={styles.actionBlockFooter}>Verified Property Block</Text>
        </View>
      );
    }

    if (msg.type === "audio") {
      // Voice messages have been removed; show a simple labelled bubble instead
      return (
        <View
          style={[
            styles.messageRow,
            msg.senderId === currentUser.id
              ? styles.justifyEnd
              : styles.justifyStart,
          ]}
        >
          <View
            style={[
              styles.bubble,
              msg.senderId === currentUser.id
                ? styles.bubbleOwn
                : styles.bubbleOther,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                msg.senderId === currentUser.id
                  ? styles.textWhite
                  : styles.textDark,
              ]}
            >
              [Voice message removed]
            </Text>
          </View>
        </View>
      );
    }

    const isOwn = msg.senderId === currentUser.id;
    return (
      <View
        style={[
          styles.messageRow,
          isOwn ? styles.justifyEnd : styles.justifyStart,
        ]}
      >
        <View
          style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
        >
          <Text
            style={[
              styles.bubbleText,
              isOwn ? styles.textWhite : styles.textDark,
            ]}
          >
            {msg.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
          enabled
          style={styles.modalAvoidingView}
        >
          <View style={styles.modalContentContainer}>
            {/* WhatsApp Security Notice Sub-Modal */}
            {showWhatsAppDisclaimer && (
              <View style={styles.disclaimerWrapper}>
                <View style={styles.disclaimerCard}>
                  <View style={styles.disclaimerIconContainer}>
                    <ShieldCheck size={24} color="#10b981" />
                  </View>
                  <Text style={styles.disclaimerTitle}>Security Notice</Text>
                  <Text style={styles.disclaimerBody}>
                    Finalizing terms on WhatsApp? Note that DirectRent can only
                    protect transactions processed through this app.
                  </Text>
                  <View style={styles.disclaimerActionColumn}>
                    <TouchableOpacity
                      style={styles.waConnectBtn}
                      onPress={confirmWhatsApp}
                    >
                      <Text style={styles.waConnectBtnText}>
                        Connect on WhatsApp
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.waCancelBtn}
                      onPress={() => setShowWhatsAppDisclaimer(false)}
                    >
                      <Text style={styles.waCancelBtnText}>KEEP IT SECURE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Header Panel */}
            <View style={styles.headerPanel}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarNodeWrapper}>
                  {otherUser?.avatarUrl ? (
                    <Image
                      source={{ uri: otherUser.avatarUrl }}
                      style={styles.avatarNodeImg}
                    />
                  ) : (
                    <Text style={styles.avatarNodeTextPlaceholder}>
                      {(otherUser?.name || listing.agent?.name || "A").charAt(
                        0,
                      )}
                    </Text>
                  )}
                  <View style={styles.avatarActiveDot} />
                </View>
                <View style={styles.headerMetaColumn}>
                  <View style={styles.metaTitleRow}>
                    <Text style={styles.headerNodeName} numberOfLines={1}>
                      {otherUser?.name || listing.agent?.name}
                    </Text>
                    {otherUser?.verificationLevel && (
                      <VerificationBadge
                        level={otherUser.verificationLevel}
                        role={otherUser.role}
                        showText={false}
                      />
                    )}
                  </View>
                  <View style={styles.activeLabelRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.activeNodeText}>
                      Active Secure Node
                    </Text>
                  </View>
                </View>
              </View>
              {currentUser.role === "tenant" ? (
                <View style={styles.headerActionRow}>
                  <TouchableOpacity
                    style={styles.headerPaymentLabelBtn}
                    onPress={() => setShowPaymentModal(true)}
                  >
                    <Text style={styles.headerPaymentLabelText}>Payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.headerActionBtn, { marginLeft: 8 }]}
                    onPress={handleReportUser}
                  >
                    <User size={16} color="#7f1d1d" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.closeModalBtn, { marginLeft: 8 }]}
                    onPress={onClose}
                  >
                    <X size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={onClose}
                >
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Referenced Property Sub-Banner */}
            <View style={styles.propertyReferenceBanner}>
              <View style={styles.propertyImageFrame}>
                <SafeImage
                  src={listing.image}
                  style={styles.propertyFrameImg}
                />
              </View>
              <View style={styles.propertyMetaContext}>
                <Text style={styles.propertyRefLabel}>Referenced Rental</Text>
                <Text style={styles.propertyTitleContext} numberOfLines={1}>
                  {listing.title}
                </Text>
              </View>
              <View style={styles.propertyPriceTag}>
                <Text style={styles.propertyPriceText}>
                  {listing?.price
                    ? listing.price
                    : formatCurrency(apartmentFee)}
                </Text>
              </View>
            </View>

            {/* Pipeline / Milestones Header */}
            <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#eef2f7', paddingVertical: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Step 1: Inspection */}
                  <View style={{ alignItems: 'center', marginRight: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: convStatus !== 'inquiry' ? '#065f46' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={14} color={convStatus !== 'inquiry' ? '#ffffff' : '#065f46'} />
                    </View>
                    <Text style={{ fontSize: 11, marginTop: 6, color: convStatus !== 'inquiry' ? '#065f46' : '#64748b', fontWeight: '700' }}>Inspection</Text>
                  </View>

                  <ChevronRight size={16} color="#cbd5e1" />

                  {/* Step 2: Contract */}
                  <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: (convStatus === 'contract_sent' || convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#4338ca' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={14} color={(convStatus === 'contract_sent' || convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#ffffff' : '#4338ca'} />
                    </View>
                    <Text style={{ fontSize: 11, marginTop: 6, color: (convStatus === 'contract_sent' || convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#4338ca' : '#64748b', fontWeight: '700' }}>Contract</Text>
                  </View>

                  <ChevronRight size={16} color="#cbd5e1" />

                  {/* Step 3: Escrow */}
                  <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: (convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#065f46' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard size={14} color={(convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#ffffff' : '#065f46'} />
                    </View>
                    <Text style={{ fontSize: 11, marginTop: 6, color: (convStatus === 'escrow_locked' || convStatus === 'disputed' || convStatus === 'completed') ? '#065f46' : '#64748b', fontWeight: '700' }}>Escrow</Text>
                  </View>

                  <ChevronRight size={16} color="#cbd5e1" />

                  {/* Step 4: Handoff */}
                  <View style={{ alignItems: 'center', marginLeft: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: convStatus === 'completed' ? '#10b981' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={14} color={convStatus === 'completed' ? '#ffffff' : '#10b981'} />
                    </View>
                    <Text style={{ fontSize: 11, marginTop: 6, color: convStatus === 'completed' ? '#10b981' : '#64748b', fontWeight: '700' }}>Handoff</Text>
                  </View>

                </View>

                {/* Right-side quick action (tenant/agent specific) */}
                <View style={{ marginLeft: 12, alignItems: 'center', justifyContent: 'center' }}>
                  {currentUser.role === 'tenant' ? (
                    convStatus === 'contract_sent' ? (
                      <TouchableOpacity onPress={() => setShowPaymentModal(true)} style={{ backgroundColor: '#065f46', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Pay Deposit</Text>
                      </TouchableOpacity>
                    ) : convStatus === 'inquiry' ? (
                      <TouchableOpacity onPress={() => handleOpenRequestTour()} style={{ backgroundColor: '#4338ca', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Book Tour</Text>
                      </TouchableOpacity>
                    ) : null
                  ) : (
                    convStatus === 'tour_requested' ? (
                      <TouchableOpacity onPress={() => handleConfirmTour({ start: new Date().toISOString(), end: new Date(new Date().getTime() + 30*60000).toISOString() })} style={{ backgroundColor: '#065f46', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Confirm Tour</Text>
                      </TouchableOpacity>
                    ) : null
                  )}
                </View>

              </ScrollView>
            </View>

            {/* Privacy Disclosure Notice */}
            {showPrivacyBanner && (
              <View style={styles.privacyBanner}>
                <View style={styles.privacyIconWrapper}>
                  <ShieldCheck size={18} color="#d97706" />
                </View>
                <Text style={styles.privacyBannerBodyText}>
                  We keep a history of your chats for safety and quality
                  assurance. Please note that security protections only apply to
                  interactions within the DirectRent app.
                </Text>
                <TouchableOpacity onPress={() => setShowPrivacyBanner(false)}>
                  <X size={14} color="#a16207" />
                </TouchableOpacity>
              </View>
            )}

            {/* Core Messages Stream */}
            <View
              style={[
                styles.chatStreamContainer,
                { paddingBottom: 100 + keyboardOffset },
              ]}
            >
              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              )}

              {isLoading ? (
                <View style={styles.streamLoadingContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.streamLoadingText}>
                    Securing Connection
                  </Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyStreamContainer}>
                  <View style={styles.emptyIconContainer}>
                    <MessageSquare size={26} color="#94a3b8" />
                  </View>
                  <Text style={styles.emptyStreamTitle}>
                    No conversation history
                  </Text>
                  <Text style={styles.emptyStreamDesc}>
                    We keep a history of your chats for safety and quality
                    assurance. Please note that security protections only apply
                    to interactions within the DirectRent app.
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMessageItem}
                  contentContainerStyle={styles.flatListContent}
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                  onLayout={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                />
              )}
            </View>

            {/* Interaction Processing Input Console */}
            <View
              style={[
                styles.inputConsolePanel,
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: keyboardOffset,
                  elevation: 20,
                  zIndex: 50,
                },
              ]}
            >
              <View style={styles.consoleRowContainer}>
                {/* single-row input + send button to remove gap */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {isRecording ? (
                    <View style={styles.recordingConsolePanel}>
                      <View style={styles.recordingIndicatorPill}>
                        <View style={styles.recordingLiveRedPulse} />
                        <Text style={styles.recordingDurationClock}>
                          {Math.floor(recordingTime / 60)}:
                          {Math.floor(recordingTime % 60)
                            .toString()
                            .padStart(2, "0")}
                        </Text>
                      </View>

                      <View style={styles.waveVisualizerTrack}>
                        {visualizerLevels.map((lvl, i) => (
                          <View
                            key={`vbar-${i}`}
                            style={[
                              styles.visualizerVerticalBar,
                              { height: lvl },
                              i % 2 === 0
                                ? styles.vBarPrimary
                                : styles.vBarSecondary,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  ) : (
                    <TextInput
                      value={newMessage}
                      onChangeText={setNewMessage}
                      placeholder="Message..."
                      placeholderTextColor="#94a3b8"
                      style={[
                        styles.terminalTextInput,
                        { flex: 1, marginRight: 8 },
                      ]}
                      editable={!isSending}
                      onFocus={() =>
                        flatListRef.current?.scrollToEnd({ animated: true })
                      }
                    />
                  )}

                  {/* Attach document button */}
                  <TouchableOpacity
                    style={[styles.consoleMicBtn, { marginRight: 8 }]}
                    onPress={handleSendDocument}
                    disabled={isSending}
                  >
                    <Paperclip size={18} color="#0f172a" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.consoleSendBtn,
                      newMessage.trim()
                        ? styles.consoleSendBtnActive
                        : styles.consoleSendBtnDisabled,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                  >
                    <ChevronRight
                      size={20}
                      color="#ffffff"
                      style={{ strokeWidth: 3 }}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Payment Modal */}
            {showPaymentModal && (
              <View style={styles.paymentModalBackdrop}>
                <View style={styles.paymentModalCard}>
                  {!paymentConfirmed ? (
                    <>
                      <Text style={styles.paymentModalTitle}>
                        Confirm Payment
                      </Text>
                      <Text style={styles.paymentModalSubtitle}>
                        {listing?.title}
                      </Text>

                      <View style={styles.paymentBreakdownRow}>
                        <Text style={styles.paymentLabel}>Apartment Fee</Text>
                        <Text style={styles.paymentValue}>
                          {formatCurrency(apartmentFee)}
                        </Text>
                      </View>

                      <View style={styles.paymentBreakdownRow}>
                        <Text style={styles.paymentLabel}>Service Fee</Text>
                        <Text style={styles.paymentValue}>
                          {formatCurrency(serviceFee)}
                        </Text>
                      </View>

                      <View style={styles.paymentBreakdownRowTotal}>
                        <Text style={styles.paymentTotalLabel}>Total</Text>
                        <Text style={styles.paymentTotalValue}>
                          {formatCurrency(total)}
                        </Text>
                      </View>

                      <View style={styles.paymentActionsRow}>
                        <TouchableOpacity
                          style={styles.paymentCancelBtn}
                          onPress={() => setShowPaymentModal(false)}
                          disabled={paymentProcessing}
                        >
                          <Text style={styles.paymentCancelText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.paymentConfirmBtn,
                            paymentProcessing && { opacity: 0.7 },
                          ]}
                          onPress={async () => {
                            setPaymentProcessing(true);
                            try {
                              // simulate calling existing pay handler
                              await handlePayNow();
                              // simulate small delay for UX
                              await new Promise((r) => setTimeout(r, 550));
                              setPaymentConfirmed(true);
                            } catch (e) {
                              console.error("Payment flow error", e);
                              setError("Failed to process payment.");
                            } finally {
                              setPaymentProcessing(false);
                            }
                          }}
                        >
                          <Text style={styles.paymentConfirmText}>Pay</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={styles.paymentConfirmedInner}>
                      <View style={styles.confirmTickCircle}>
                        <Text style={styles.confirmTick}>✓</Text>
                      </View>
                      <Text style={styles.paymentSuccessText}>
                        Payment Confirmed
                      </Text>
                      <TouchableOpacity
                        style={styles.paymentDoneBtn}
                        onPress={() => {
                          setPaymentConfirmed(false);
                          setShowPaymentModal(false);
                        }}
                      >
                        <Text style={styles.paymentDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Tour Request Modal */}
            {showTourModal && (
              <View style={styles.tourModalBackdrop}>
                <View style={styles.tourModalCard}>
                  <Text style={styles.tourModalTitle}>Request a Tour</Text>
                  <Text style={styles.tourModalSubtitle}>
                    {listing.title}
                  </Text>

                  <View style={styles.tourFormGroup}>
                    <Text style={styles.tourLabel}>Date</Text>
                    <TextInput
                      value={tourDate}
                      onChangeText={setTourDate}
                      placeholder="Select a date"
                      style={styles.tourInput}
                    />
                  </View>

                  <View style={styles.tourFormGroup}>
                    <Text style={styles.tourLabel}>Time</Text>
                    <TextInput
                      value={tourTime}
                      onChangeText={setTourTime}
                      placeholder="Select a time"
                      style={styles.tourInput}
                    />
                  </View>

                  <View style={styles.tourFormGroup}>
                    <Text style={styles.tourLabel}>Location</Text>
                    <TextInput
                      value={tourLocation}
                      onChangeText={setTourLocation}
                      placeholder="Tour location"
                      style={styles.tourInput}
                    />
                  </View>

                  <View style={styles.tourFormGroup}>
                    <Text style={styles.tourLabel}>Message</Text>
                    <TextInput
                      value={tourMessage}
                      onChangeText={setTourMessage}
                      placeholder="Any specific requests?"
                      style={styles.tourInput}
                    />
                  </View>

                  <View style={styles.tourActionsRow}>
                    <TouchableOpacity
                      style={styles.tourCancelBtn}
                      onPress={() => setShowTourModal(false)}
                    >
                      <Text style={styles.tourCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.tourSubmitBtn}
                      onPress={handleSubmitTourRequest}
                      disabled={isSending}
                    >
                      <Text style={styles.tourSubmitText}>
                        {isSending ? "Sending..." : "Request Tour"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContentContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: SCREEN_HEIGHT * 0.85,
    overflow: "hidden",
  },
  modalAvoidingView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  disclaimerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  disclaimerCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  disclaimerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  disclaimerBody: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
  },
  disclaimerActionColumn: {
    width: "100%",
    gap: 8,
  },
  waConnectBtn: {
    width: "100%",
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  waConnectBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  waCancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  waCancelBtnText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerPanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarNodeWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    position: "relative",
  },
  avatarNodeImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarNodeTextPlaceholder: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563eb",
  },
  avatarActiveDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    backgroundColor: "#10b981",
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  headerMetaColumn: {
    marginLeft: 12,
    flex: 1,
  },
  metaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  headerNodeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginRight: 6,
    maxWidth: "70%",
  },
  activeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 6,
  },
  activeNodeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
   },
  propertyReferenceBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
  },
  propertyImageFrame: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  propertyFrameImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  propertyMetaContext: {
    marginLeft: 12,
    flex: 1,
  },
  propertyRefLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  propertyTitleContext: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  propertyPriceTag: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  propertyPriceText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563eb",
  },
  actionTriggersScrollWrapper: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  actionHorizontalScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0e7ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3730a3",
  },
  actionBtnSuccess: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#d1fae5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  actionBtnSuccessText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46",
  },
  actionBtnSolidPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#2563eb",
    borderRadius: 10,
  },
  actionBtnSolidPrimaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  actionBtnSolidSuccess: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#10b981",
    borderRadius: 10,
  },
  actionBtnSolidSuccessText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  actionBtnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  actionBtnWhatsApp: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  actionBtnWhatsAppText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  privacyBanner: {
    backgroundColor: "#fffbeb",
    borderBottomWidth: 1,
    borderColor: "#fef3c7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  privacyIconWrapper: {
    marginRight: 8,
    marginTop: 2,
  },
  privacyBannerBodyText: {
    flex: 1,
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
    fontWeight: "500",
    paddingRight: 8,
  },
  chatStreamContainer: {
    flex: 1,
    backgroundColor: "rgba(248, 250, 252, 0.4)",
  },
  errorBanner: {
    padding: 10,
    backgroundColor: "#fff1f2",
    borderBottomWidth: 1,
    borderColor: "#ffe4e6",
  },
  errorBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e11d48",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streamLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  streamLoadingText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  emptyStreamContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  emptyStreamTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptyStreamDesc: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
    width: "100%",
  },
  justifyEnd: {
    justifyContent: "flex-end",
  },
  justifyStart: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleOwn: {
    backgroundColor: "#3b82f6",
    borderBottomRightRadius: 0,
  },
  bubbleOther: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomLeftRadius: 0,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  textWhite: {
    color: "#ffffff",
  },
  textDark: {
    color: "#1e293b",
  },
  actionMessageContainer: {
    alignSelf: "center",
    width: "90%",
    backgroundColor: "rgba(238, 242, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(224, 231, 255, 0.8)",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    marginVertical: 12,
  },
  actionIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionUpdateLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#4f46e5",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  actionContentText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16,
  },
  actionBlockFooter: {
    fontSize: 8,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6,
  },
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 22,
    width: 240,
    justifyContent: "space-between",
  },
  audioOwn: {
    backgroundColor: "#3b82f6",
  },
  audioOther: {
    backgroundColor: "#f1f5f9",
  },
  inputConsolePanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    position: "absolute",
    left: 0,
    right: 0,
       bottom: 0,
    elevation: 20,
    zIndex: 50,
  },

  /* Layout for the input row: force a horizontal layout so the send button sits beside the input */
  consoleRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  /* Input area should take remaining space */
  inputFlexibleSlot: {
    flex: 1,
    marginRight: 8,
  },

  /* Action group holds mic / send buttons */
  consoleActionGroup: {
    width: 96,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },

  /* layout for small inline action buttons */
  actionButtonsInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  consoleMicBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  consoleTrashBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fee2e2",
    marginRight: 8,
  },
  consoleSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
  },
  consoleSendBtnDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.9,
  },
  consoleSendBtnActive: {
    backgroundColor: "#2563eb",
  },
  terminalTextInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
  },

  /* Recording panel - keep same height as text input so layout doesn't grow */
  recordingConsolePanel: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  recordingIndicatorPill: {
    minWidth: 72,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    flexDirection: "row",
  },
  recordingLiveRedPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginRight: 8,
  },
  recordingDurationClock: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  waveVisualizerTrack: {
    flex: 1,
    height: 20,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  visualizerVerticalBar: {
    width: 2,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  vBarPrimary: {
    backgroundColor: "#3b82f6",
  },
  vBarSecondary: {
    backgroundColor: "#cbd5e1",
  },
  /* Payment button & modal styles */
  headerPaymentLabelBtn: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  headerPaymentLabelText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#065f46",
  },
  paymentModalBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  paymentModalCard: {
    width: "90%",
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  paymentModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  paymentModalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
  },
  paymentBreakdownRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  paymentLabel: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "700",
  },
  paymentValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "900",
  },
  paymentActionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  paymentCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  paymentConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#065f46",
    minWidth: 96,
  },
  paymentConfirmText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },
  paymentConfirmedInner: {
    alignItems: "center",
    paddingVertical: 12,
  },
  confirmTickCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTick: {
    fontSize: 36,
    color: "#065f46",
    fontWeight: "900",
  },
  paymentSuccessText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#065f46",
    marginBottom: 12,
  },
  paymentDoneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
  },
  paymentDoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  tourModalBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  tourModalCard: {
    width: "90%",
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  tourModalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  tourModalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  tourFormGroup: {
    width: "100%",
    marginBottom: 12,
  },
  tourLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    marginBottom: 4,
  },
  tourInput: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#0f172a",
  },
  tourActionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  tourCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  tourCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  tourSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#065f46",
    minWidth: 96,
  },
  tourSubmitText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },
});

export default ChatModal;
