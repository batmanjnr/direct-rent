import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Building2,
  MapPin,
  Camera,
  Plus,
  X,
  Check,
  Info,
  Navigation,
  ArrowLeft,
  Video,
  Upload,
  AlertCircle
} from 'lucide-react-native';
import { db, storage } from '../../lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker'; // Required for mobile media

const SUGGESTED_TYPES = ["Self-Contain", "1 Bedroom Flat", "2 Bedroom Flat", "3 Bedroom Flat", "Duplex"];
const AMENITIES_LIST = ["Running Water", "Security", "Prepaid Meter", "Parking", "Solar/Inverter"];

export default function CreateListing() {
  const { user, setActiveTab, currentListing, setCurrentListing } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEditMode = !!currentListing && currentListing.agent?.id === user?.id;

  const [formData, setFormData] = useState({
    title: currentListing?.title || '',
    priceValue: currentListing?.priceValue?.toString() || '',
    location: currentListing?.location || '',
    type: currentListing?.type || '',
    landmark: currentListing?.landmark || '',
    description: currentListing?.description || '',
    images: currentListing?.images || [],
    video: currentListing?.video || '',
    amenities: currentListing?.amenities || []
  });

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setFormData(prev => ({ ...prev, images: [...prev.images, ...newImages].slice(0, 10) }));
    }
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });

    if (!result.canceled) {
      setFormData(prev => ({ ...prev, video: result.assets[0].uri }));
    }
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handlePublish = async () => {
    if (formData.images.length < 3) {
      setError("Minimum 3 photos required");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const listingId = isEditMode ? currentListing.id : `listing_${Date.now()}`;
      
      // Upload logic (Simplified for brevity - repeat for all images/video)
      const uploadedImageUrls = [];
      for (const uri of formData.images) {
        if (uri.startsWith('http')) {
          uploadedImageUrls.push(uri);
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          const storageRef = ref(storage, `listings/${listingId}/${Date.now()}.jpg`);
          await uploadBytes(storageRef, blob);
          uploadedImageUrls.push(await getDownloadURL(storageRef));
        }
      }

      const listingData = {
        ...formData,
        price: `₦${parseInt(formData.priceValue).toLocaleString()}`,
        image: uploadedImageUrls[0],
        images: uploadedImageUrls,
        agent: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          isVerified: user.verificationLevel === 'verified'
        },
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, 'listings', listingId);
      isEditMode ? await updateDoc(docRef, listingData) : await setDoc(docRef, listingData);

      setCurrentListing(null);
      setActiveTab('home');
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setActiveTab('home')}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit' : 'Post'} Listing</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        
        <Text style={styles.label}>PROPERTY PHOTOS (MIN 3)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
          {formData.images.map((uri, idx) => (
            <View key={idx} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.thumbnail} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => {
                setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
              }}>
                <X size={12} color="white" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addMediaBox} onPress={pickImage}>
            <Plus size={24} color="#94a3b8" />
          </TouchableOpacity>
        </ScrollView>

        
        <View style={styles.card}>
          <Text style={styles.label}>LISTING TITLE</Text>
          <View style={styles.inputWrapper}>
            <Building2 size={18} color="#cbd5e1" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Luxury Studio"
              value={formData.title}
              onChangeText={(t) => setFormData(p => ({ ...p, title: t }))}
            />
          </View>

          <Text style={styles.label}>ANNUAL RENT (₦)</Text>
          <TextInput
            style={styles.inputSimple}
            keyboardType="numeric"
            placeholder="350,000"
            value={formData.priceValue}
            onChangeText={(t) => setFormData(p => ({ ...p, priceValue: t }))}
          />
        </View>

        
        <Text style={styles.label}>AMENITIES</Text>
        <View style={styles.amenityGrid}>
          {AMENITIES_LIST.map(item => (
            <TouchableOpacity 
              key={item} 
              onPress={() => toggleAmenity(item)}
              style={[styles.amenityBtn, formData.amenities.includes(item) && styles.amenitySelected]}
            >
              <Text style={[styles.amenityText, formData.amenities.includes(item) && { color: 'white' }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handlePublish}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Publish Listing</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: 'white' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  scrollContent: { padding: 16 },
  label: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 8, marginTop: 16 },
  mediaRow: { flexDirection: 'row', marginBottom: 10 },
  imageWrapper: { width: 100, height: 100, marginRight: 10, borderRadius: 12, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 10 },
  addMediaBox: { width: 100, height: 100, borderStyle: 'dashed', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 20, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 14 },
  inputSimple: { backgroundColor: '#f1f5f9', borderRadius: 12, height: 50, paddingHorizontal: 15, fontSize: 14 },
  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0' },
  amenitySelected: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  amenityText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { backgroundColor: '#0284c7', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
  submitText: { color: 'white', fontWeight: 'bold' },
  errorText: { color: '#ef4444', fontWeight: 'bold', textAlign: 'center' }
});