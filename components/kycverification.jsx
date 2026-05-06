import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ActivityIndicator, 
  Alert,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import { 
  ShieldCheck, 
  Camera, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Fingerprint 
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker'; // Using Expo for cross-platform ease
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const KYCVerification = () => {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const [idType, setIdType] = useState(user?.govtIdType || '');

  if (!user || user.role !== 'agent') return null;

  const isVerified = user.verificationStatus === 'verified';
  const isPending = user.verificationStatus === 'pending';

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleFileUpload = async (type) => {
    if (type === 'govtId' && !idType) {
      Alert.alert('Selection Required', 'Please select an ID type first.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera roll is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      try {
        setIsLoading(true);
        setUploadStatus(type === 'govtId' ? 'uploading_id' : 'uploading_selfie');
        
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();

        const fileName = `kyc/${type}/${user.id}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        const updateData = { [`${type}Url`]: downloadURL };
        if (type === 'govtId') updateData.govtIdType = idType;

        await updateProfile(updateData);
      } catch (error) {
        Alert.alert("Upload Failed", "Failed to upload document. Please try again.");
      } finally {
        setIsLoading(false);
        setUploadStatus('idle');
      }
    }
  };

  const idTypes = ['NIN Slip', 'National ID Card', 'Drivers License', 'Passport'];

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpand} style={styles.headerTrigger}>
        <View style={[styles.iconBox, isVerified ? styles.verifiedBox : styles.unverifiedBox]}>
          {isVerified ? <ShieldCheck size={20} color="#10b981" /> : <Fingerprint size={20} color="#f97316" />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.titleText}>Agent Verification</Text>
          <Text style={styles.subText}>
            {isVerified ? 'You are a Verified Agent' : isPending ? 'Verification in review' : 'Get verified to build trust'}
          </Text>
        </View>
        <View style={[styles.statusBadge, isVerified ? styles.verifiedBadge : isPending ? styles.pendingBadge : styles.requiredBadge]}>
          <Text style={styles.statusBadgeText}>{isVerified ? 'Verified' : isPending ? 'Pending' : 'Required'}</Text>
        </View>
        <ChevronRight size={20} color="#cbd5e1" style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.label}>Select ID Type</Text>
          <View style={styles.idGrid}>
            {idTypes.map((type) => (
              <TouchableOpacity
                key={type}
                disabled={isVerified || isPending || isLoading}
                onPress={() => setIdType(type)}
                style={[styles.idButton, idType === type && styles.idButtonActive]}
              >
                <Text style={[styles.idButtonText, idType === type && styles.idButtonTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.uploadGrid}>
            
            <View style={styles.uploadColumn}>
              <Text style={styles.label}>ID Front View</Text>
              <TouchableOpacity 
                disabled={isVerified || isPending || isLoading || !idType}
                onPress={() => handleFileUpload('govtId')}
                style={[styles.uploadBox, !idType && { opacity: 0.5 }]}
              >
                {uploadStatus === 'uploading_id' ? (
                  <ActivityIndicator color="#0284c7" />
                ) : user.govtIdUrl ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: user.govtIdUrl }} style={styles.previewImage} />
                    <View style={styles.checkOverlay}><CheckCircle2 size={32} color="#10b981" /></View>
                  </View>
                ) : (
                  <><FileText size={24} color="#94a3b8" /><Text style={styles.uploadLabel}>Upload ID</Text></>
                )}
              </TouchableOpacity>
            </View>

            
            <View style={styles.uploadColumn}>
              <Text style={styles.label}>Live Selfie</Text>
              <TouchableOpacity 
                disabled={isVerified || isPending || isLoading}
                onPress={() => handleFileUpload('selfie')}
                style={styles.uploadBox}
              >
                {uploadStatus === 'uploading_selfie' ? (
                  <ActivityIndicator color="#0284c7" />
                ) : user.selfieUrl ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: user.selfieUrl }} style={styles.previewImage} />
                    <View style={styles.checkOverlay}><CheckCircle2 size={32} color="#10b981" /></View>
                  </View>
                ) : (
                  <><Camera size={24} color="#94a3b8" /><Text style={styles.uploadLabel}>Take Selfie</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {!isVerified && !isPending && (
            <TouchableOpacity
              disabled={!user.govtIdUrl || !user.selfieUrl || isLoading}
              onPress={async () => {
                setIsLoading(true);
                try {
                  await updateProfile({ verificationStatus: 'pending' });
                  Alert.alert("Submitted", "Our team will review your ID within 24-48 hours.");
                } catch (err) { Alert.alert("Error", "Submission failed."); }
                finally { setIsLoading(false); }
              }}
              style={[styles.submitBtn, (!user.govtIdUrl || !user.selfieUrl) && styles.submitBtnDisabled]}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for Review</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff' },
  headerTrigger: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifiedBox: { backgroundColor: '#ecfdf5' },
  unverifiedBox: { backgroundColor: '#fff7ed' },
  headerInfo: { flex: 1, marginLeft: 12 },
  titleText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  subText: { fontSize: 10, color: '#94a3b8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  verifiedBadge: { backgroundColor: '#d1fae5' },
  pendingBadge: { backgroundColor: '#fef3c7' },
  requiredBadge: { backgroundColor: '#ffedd5' },
  statusBadgeText: { fontSize: 9, fontWeight: '900', color: '#166534' },
  content: { padding: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  label: { fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  idGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  idButton: { flex: 1, minWidth: '45%', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff', alignItems: 'center' },
  idButtonActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  idButtonText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  idButtonTextActive: { color: '#fff' },
  uploadGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  uploadColumn: { flex: 1 },
  uploadBox: { aspectRatio: 1, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  uploadLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginTop: 8 },
  previewContainer: { width: '100%', height: '100%', position: 'relative' },
  previewImage: { width: '100%', height: '100%', borderRadius: 18, opacity: 0.5 },
  checkOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#0284c7', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#e2e8f0' },
  submitBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }
});

export default KYCVerification;