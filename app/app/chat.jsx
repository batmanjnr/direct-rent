import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Platform,
  RefreshControl,
} from "react-native";
import {
  MessageSquare,
  Search,
  Home,
  Loader2,
  Bell,
  ChevronRight,
} from "lucide-react-native";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import VerificationBadge from "../../components/verificationbadge";
import ChatModal from "../../components/chatmodal";
import { useTheme } from '../../context/ThemeContext';

// Custom hook for live participant info
const useParticipant = (userId) => {
  const [participant, setParticipant] = useState(null);

  useEffect(() => {
    if (!userId || userId === 'unknown') return;

    return onSnapshot(doc(db, "users", userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setParticipant({
          name: data.firstName || data.lastName 
            ? `${data.firstName || ''} ${data.lastName || ''}`.trim() 
            : (data.name || "User"),
          avatarUrl: data.avatarUrl,
          verificationLevel: data.verificationLevel === 'verified' ? 'verified' : 'none'
        });
      }
    });
  }, [userId]);

  return participant;
};

// Avatar component with property overlay
const ConversationAvatar = ({ userId, initialImage, initialName, listingImage }) => {
  const participant = useParticipant(userId);
  const avatarUrl = participant?.avatarUrl || initialImage;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View style={styles.avatarContainer}>
      <View style={[styles.mainAvatar, { backgroundColor: isDark ? '#0b1220' : '#f0f9ff' }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.fullImage} />
        ) : (
          <Text style={styles.avatarPlaceholder}>
            {(participant?.name || initialName || "?").charAt(0)}
          </Text>
        )}
      </View>
      <View style={[styles.listingOverlay, { borderColor: isDark ? '#0b1220' : '#fff' }]}>
        <Image source={{ uri: listingImage }} style={styles.fullImage} />
      </View>
    </View>
  );
};

const ConversationRow = ({ conv, user, onClick, getTimeAgo, getStatusConfig }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const participantId = user?.role === "tenant" ? conv.agentId : conv.tenantId;
  const participant = useParticipant(participantId);
  
  const displayName = participant?.name || (user?.role === "tenant" ? conv.agentName : conv.tenantName);
  const unreadCount = user?.role === 'tenant' ? conv.unreadCount_tenant : conv.unreadCount_agent;
  const status = getStatusConfig(conv.status || "inquiry");

  return (
    <TouchableOpacity onPress={onClick} style={[styles.row, { backgroundColor: isDark ? '#0b1220' : '#fff', borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
      <ConversationAvatar 
        userId={participantId}
        initialImage={user?.role === "tenant" ? conv.agentImage : conv.tenantImage}
        initialName={displayName}
        listingImage={conv.listingImage}
      />

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <View style={styles.nameSection}>
            <Text style={[styles.displayName, { color: isDark ? '#fff' : '#0f172a' }]} numberOfLines={1}>{displayName}</Text>
            {participant?.verificationLevel === 'verified' && (
              <VerificationBadge level="verified" showText={false} style={styles.vBadge} />
            )}
          </View>
          <Text style={[styles.timeText, { color: isDark ? '#94a3b8' : '#94a3b8' }]}>{getTimeAgo(conv.updatedAt)}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusTag, { backgroundColor: status.bgColor }]}> 
            <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.listingRow}>
          <Home size={10} color={isDark ? '#94a3b8' : '#94a3b8'} />
          <Text style={[styles.listingTitle, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{conv.listingTitle}</Text>
        </View>

        <Text style={[styles.lastMessage, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>{conv.lastMessage}</Text>
      </View>

      {unreadCount > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: '#0284c7' }]}>
          <Text style={styles.unreadText}>{unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const Inbox = () => {
  const { user, setActiveTab } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "conversations"),
      where(user.role === "tenant" ? "tenantId" : "agentId", "==", user.id),
      orderBy("updatedAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const q = query(
        collection(db, 'conversations'),
        where(user.role === 'tenant' ? 'tenantId' : 'agentId', '==', user.id),
        orderBy('updatedAt', 'desc')
      );
      const snap = await getDocs(q);
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  };
  
  const getStatusConfig = (status) => {
    const configs = {
      contract_requested: { label: "Requested", textColor: "#0284c7", bgColor: "#f0f9ff" },
      contract_sent: { label: "Review", textColor: "#d97706", bgColor: "#fffbeb" },
      paid: { label: "Paid", textColor: "#059669", bgColor: "#ecfdf5" },
      completed: { label: "Completed", textColor: "#64748b", bgColor: "#f8fafc" },
    };
    return configs[status] || { label: "Inquiry", textColor: "#64748b", bgColor: "#f8fafc" };
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const filtered = conversations.filter(c => 
    c.listingTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <View style={styles.centered}><ActivityIndicator color="#0284c7" /></View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#020617' : '#fff' }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Messages</Text>
        <TouchableOpacity onPress={() => setActiveTab('notifications')}>
          <Bell size={22} color={isDark ? '#cbd5e1' : '#0f172a'} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={16} color={isDark ? '#94a3b8' : '#94a3b8'} style={styles.searchIcon} />
        <TextInput
          placeholder="Search conversations..."
          placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
          style={[styles.searchInput, { backgroundColor: isDark ? '#0b1220' : '#f8fafc', color: isDark ? '#fff' : '#0f172a' }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ConversationRow 
            conv={item} 
            user={user} 
            onClick={() => setSelectedConv(item)}
            getTimeAgo={getTimeAgo}
            getStatusConfig={getStatusConfig}
          />
        )}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={isDark ? '#334155' : '#e2e8f0'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#94a3b8' : '#0f172a' }]}>Your inbox is clear</Text>
          </View>
        }
      />

      {selectedConv && (
        <ChatModal
          isOpen={!!selectedConv}
          onClose={() => setSelectedConv(null)}
          conversationId={selectedConv.id}
          currentUser={user}
          listing={{
            id: selectedConv.listingId || selectedConv.listingId?.toString(),
            title: selectedConv.listingTitle,
            image: selectedConv.listingImage,
            agent: { id: selectedConv.agentId, name: selectedConv.agentName }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  searchContainer: { marginHorizontal: 20, marginBottom: 20, position: 'relative' },
  searchIcon: { position: 'absolute', left: 15, top: 15, zIndex: 1 },
  searchInput: { backgroundColor: '#f8fafc', padding: 12, paddingLeft: 45, borderRadius: 12, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  row: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  avatarContainer: { position: 'relative', marginRight: 15 },
  mainAvatar: { width: 55, height: 55, borderRadius: 28, backgroundColor: '#f0f9ff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { fontSize: 20, fontWeight: 'bold', color: '#0284c7' },
  listingOverlay: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' },
  fullImage: { width: '100%', height: '100%' },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  displayName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginRight: 5 },
  timeText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
  statusRow: { marginBottom: 4 },
  statusTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  listingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  listingTitle: { fontSize: 10, fontWeight: '900', color: '#64748b', marginLeft: 4, textTransform: 'uppercase' },
  lastMessage: { fontSize: 13, color: '#64748b' },
  unreadBadge: { backgroundColor: '#0284c7', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 12, top: '45%' },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 10 }
});

export default Inbox;