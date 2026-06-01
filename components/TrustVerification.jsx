import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import {
  ShieldCheck,
  Smartphone,
  BadgeCheck,
  ChevronRight,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; // Reusing your theme engine structure
import { calculateVerificationLevel } from '../lib/verification';

// Enable LayoutAnimation for smooth expansion transitions on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TrustVerification = ({ onVerifyPhone }) => {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [nin, setNin] = useState(user?.nin || '');
  const [isSaving, setIsSaving] = useState(false);
  const [ninError, setNinError] = useState('');

  if (!user || (user.role !== 'tenant' && user.role !== 'agent')) return null;

  const isDark = theme === 'dark';
  const currentLevel = calculateVerificationLevel(user);
  const hasPhone = !!user.phoneNumber && user.phoneVerified;
  const hasNin = !!user.nin && user.nin.length === 11;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  const handleSaveNin = async () => {
    if (nin.length !== 11) {
      setNinError('NIN must be 11 digits');
      return;
    }
    setNinError('');
    setIsSaving(true);
    try {
      await updateProfile({ nin });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(false);
    } catch (error) {
      console.error("Error saving NIN:", error);
      setNinError('Failed to save NIN. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Theme style mapping variations
  const dynamicContainer = isDark ? styles.bgDark : styles.bgLight;
  const dynamicText = isDark ? styles.textDark : styles.textLight;
  const dynamicSubText = isDark ? styles.subTextDark : styles.subTextLight;
  const dynamicBorder = isDark ? styles.borderDark : styles.borderLight;
  const dynamicInput = isDark ? styles.inputDark : styles.inputLight;
  const dynamicCard = isDark ? styles.cardDark : styles.cardLight;

  return (
    <View style={[styles.container, dynamicContainer]}>
      {/* Header Button Toggle Trigger */}
      <TouchableOpacity
        onClick={toggleExpand} /* Native maps directly via fallback compatibility triggers */
        onPress={toggleExpand}
        activeOpacity={0.7}
        style={[styles.triggerBtn, isExpanded && dynamicBorder, isExpanded && styles.borderBottomActive]}
      >
        <View style={[
          styles.iconContainer,
          currentLevel === 'verified' 
            ? (isDark ? styles.iconVerifiedDark : styles.iconVerifiedLight)
            : (isDark ? styles.iconDefaultDark : styles.iconDefaultLight)
        ]}>
          <ShieldCheck 
            size={20} 
            color={currentLevel === 'verified' ? '#10b981' : '#3b82f6'} 
          />
        </View>

        <View style={styles.metaWrapper}>
          <Text style={[styles.title, dynamicText]}>Trust & Verification</Text>
          <Text style={[styles.subtitle, dynamicSubText]}>
            {currentLevel === 'verified' ? 'Your account is highly trusted' : 'Increase your trust level by verifying identity'}
          </Text>
        </View>

        {!hasNin && (
          <View style={[styles.boostBadge, isDark ? styles.boostBadgeDark : styles.boostBadgeLight]}>
            <Text style={[styles.boostText, isDark ? styles.boostTextDark : styles.boostTextLight]}>Boost</Text>
          </View>
        )}

        <View style={isExpanded ? styles.rotatedIcon : null}>
          <ChevronRight size={20} color={isDark ? '#334155' : '#cbd5e1'} />
        </View>
      </TouchableOpacity>

      {/* Accordion Content Block conditional wrapper matching web logic */}
      {isExpanded && (
        <View style={[styles.expandedContent, isDark ? styles.expandedContentDark : styles.expandedContentLight]}>
          
          {/* Status Verification Grid Column Mapping equivalent */}
          <View style={styles.gridContainer}>
            {/* Phone Identity Block */}
            <View style={[
              styles.gridItem, 
              dynamicCard, 
              dynamicBorder, 
              hasPhone && (isDark ? styles.gridItemSuccessDark : styles.gridItemSuccessLight)
            ]}>
              <View style={[styles.statusIconCircle, hasPhone ? styles.successBg : (isDark ? styles.statusIconDark : styles.statusIconLight)]}>
                <Smartphone size={16} color={hasPhone ? '#ffffff' : '#94a3b8'} />
              </View>
              <Text style={styles.gridTag}>PHONE</Text>
              <View style={styles.gridActionRow}>
                <Text style={[styles.statusStateText, hasPhone ? styles.textSuccess : styles.textMuted]}>
                  {hasPhone ? 'Verified' : 'Unverified'}
                </Text>
                {!hasPhone && onVerifyPhone && (
                  <TouchableOpacity onPress={onVerifyPhone}>
                    <Text style={styles.actionLinkText}>Verify Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* NIN Identity Block */}
            <View style={[
              styles.gridItem, 
              dynamicCard, 
              dynamicBorder, 
              hasNin && (isDark ? styles.gridItemSuccessDark : styles.gridItemSuccessLight)
            ]}>
              <View style={[styles.statusIconCircle, hasNin ? styles.successBg : (isDark ? styles.statusIconDark : styles.statusIconLight)]}>
                <Fingerprint size={16} color={hasNin ? '#ffffff' : '#94a3b8'} />
              </View>
              <Text style={styles.gridTag}>ID (NIN)</Text>
              <Text style={[styles.statusStateText, hasNin ? styles.textSuccess : styles.textMuted]}>
                {hasNin ? 'Added' : 'Optional'}
              </Text>
            </View>
          </View>

          {/* NIN Action Form Handling conditional layer */}
          {!hasNin && (
            <View style={styles.formSection}>
              <View style={styles.inputLabelContainer}>
                <Text style={[styles.inputLabel, isDark ? styles.labelDark : styles.labelLight]}>
                  ADD NATIONAL IDENTITY NUMBER (NIN)
                </Text>
                
                <View style={styles.relativeInputWrapper}>
                  <TextInput
                    style={[styles.inputNative, dynamicInput, dynamicText]}
                    maxLength={11}
                    keyboardType="numeric"
                    value={nin}
                    onChangeText={(text) => setNin(text.replace(/\D/g, '').slice(0, 11))}
                    placeholder="Enter 11-digit NIN"
                    placeholderTextColor={isDark ? '#475569' : '#cbd5e1'}
                  />
                  {nin.length === 11 && !hasNin && (
                    <View style={styles.absoluteIndicator}>
                      <CheckCircle2 size={18} color="#4f46e5" />
                    </View>
                  )}
                </View>

                {ninError ? (
                  <View style={styles.errorContainer}>
                    <AlertCircle size={12} color="#f43f5e" />
                    <Text style={styles.errorText}>{ninError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Informative Value Prop Banner Contextual Mapping */}
              <View style={[styles.infoBanner, isDark ? styles.infoBannerDark : styles.infoBannerLight]}>
                <BadgeCheck size={20} color="#3b82f6" style={styles.bannerIconTop} />
                <View style={styles.bannerTextContainer}>
                  <Text style={[styles.bannerTitle, isDark ? styles.bannerTitleDark : styles.bannerTitleLight]}>WHY ADD NIN?</Text>
                  <Text style={[styles.bannerMessage, isDark ? styles.bannerMessageDark : styles.bannerMessageLight]}>
                    {user.role === 'agent'
                      ? 'Linking your NIN establishes professional credentials as a verified agent. It builds instant trust with prospective tenants and boosts your profile ranking.'
                      : "Adding your NIN shows agents you're a serious tenant. It increases your trust score and makes your rental applications stand out."}
                  </Text>
                </View>
              </View>

              {/* Form Actions Button */}
              <TouchableOpacity
                onPress={handleSaveNin}
                disabled={nin.length !== 11 || isSaving}
                activeOpacity={0.8}
                style={[
                  styles.submitBtn,
                  nin.length === 11 && !isSaving ? styles.submitBtnEnabled : (isDark ? styles.submitBtnDisabledDark : styles.submitBtnDisabledLight)
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.submitBtnText, nin.length === 11 && !isSaving ? styles.submitBtnTextEnabled : styles.submitBtnTextDisabled]}>
                    Save & Boost Trust
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Success static block UI confirmation layer */}
          {hasNin && (
            <View style={[styles.successStateBanner, isDark ? styles.successStateBannerDark : styles.successStateBannerLight]}>
              <View style={styles.successBadgeCircle}>
                <BadgeCheck size={22} color="#ffffff" />
              </View>
              <View>
                <Text style={[styles.successStateTitle, isDark ? styles.textDark : { color: '#064e3b' }]}>Identity Linked</Text>
                <Text style={[styles.successStateSub, isDark ? styles.subTextDark : { color: '#047857' }]}>NIN added successfully</Text>
              </View>
            </View>
          )}

        </View>
      )}
    </View>
  );
};

export default TrustVerification;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  bgLight: {
    backgroundColor: '#ffffff',
  },
  bgDark: {
    backgroundColor: '#0f172a',
  },
  cardLight: {
    backgroundColor: '#ffffff',
  },
  cardDark: {
    backgroundColor: '#020617',
  },
  textLight: {
    color: '#0f172a',
  },
  textDark: {
    color: '#f8fafc',
  },
  subTextLight: {
    color: '#94a3b8',
  },
  subTextDark: {
    color: '#64748b',
  },
  borderLight: {
    borderColor: '#f1f5f9',
  },
  borderDark: {
    borderColor: '#1e293b',
  },
  borderBottomActive: {
    borderBottomWidth: 1,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#f1f5f9',
  },
  inputDark: {
    backgroundColor: '#020617',
    borderColor: '#1e293b',
  },
  triggerBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconVerifiedLight: {
    backgroundColor: '#ecfdf5',
  },
  iconVerifiedDark: {
    backgroundColor: 'rgba(6, 78, 59, 0.2)',
  },
  iconDefaultLight: {
    backgroundColor: '#eff6ff',
  },
  iconDefaultDark: {
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
  },
  metaWrapper: {
    flex: 1,
    marginLeft: 16,
    textAlign: 'left',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  boostBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  boostBadgeLight: {
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  boostBadgeDark: {
    backgroundColor: 'rgba(124, 45, 18, 0.4)',
    borderColor: '#4c1d95',
  },
  boostText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  boostTextLight: {
    color: '#ea580c',
  },
  boostTextDark: {
    color: '#fb923c',
  },
  rotatedIcon: {
    transform: [{ rotate: '90deg' }],
  },
  expandedContent: {
    padding: 20,
    borderTopWidth: 1,
  },
  expandedContentLight: {
    backgroundColor: 'rgba(241, 245, 249, 0.3)',
    borderColor: '#f1f5f9',
  },
  expandedContentDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.2)',
    borderColor: '#1e293b',
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  gridItem: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  gridItemSuccessLight: {
    backgroundColor: 'rgba(236, 253, 245, 0.5)',
    borderColor: '#d1fae5',
  },
  gridItemSuccessDark: {
    backgroundColor: 'rgba(6, 78, 59, 0.1)',
    borderColor: 'rgba(6, 78, 59, 0.3)',
  },
  statusIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusIconLight: {
    backgroundColor: '#f1f5f9',
  },
  statusIconDark: {
    backgroundColor: '#1e293b',
  },
  successBg: {
    backgroundColor: '#10b981',
  },
  gridTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  gridActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  statusStateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textSuccess: {
    color: '#059669',
  },
  textMuted: {
    color: '#94a3b8',
  },
  actionLinkText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formSection: {
    gap: 16,
  },
  inputLabelContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingLeft: 4,
  },
  labelLight: {
    color: '#64748b',
  },
  labelDark: {
    color: '#94a3b8',
  },
  relativeInputWrapper: {
    position: 'relative',
    width: '100%',
  },
  inputNative: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    fontWeight: '700',
  },
  absoluteIndicator: {
    position: 'absolute',
    right: 14,
    top: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f43f5e',
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoBannerLight: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  infoBannerDark: {
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    borderColor: '#1e3a8a',
  },
  bannerIconTop: {
    marginTop: 2,
  },
  bannerTextContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  bannerTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bannerTitleLight: {
    color: '#1d4ed8',
  },
  bannerTitleDark: {
    color: '#60a5fa',
  },
  bannerMessage: {
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '500',
  },
  bannerMessageLight: {
    color: 'rgba(29, 78, 216, 0.8)',
  },
  bannerMessageDark: {
    color: 'rgba(96, 165, 251, 0.6)',
  },
  submitBtn: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitBtnEnabled: {
    backgroundColor: '#4f46e5',
    ...Platform.select({
      ios: {
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitBtnDisabledLight: {
    backgroundColor: '#e2e8f0',
  },
  submitBtnDisabledDark: {
    backgroundColor: '#1e293b',
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  submitBtnTextEnabled: {
    color: '#ffffff',
  },
  submitBtnTextDisabled: {
    color: '#94a3b8',
  },
  successStateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  successStateBannerLight: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  successStateBannerDark: {
    backgroundColor: 'rgba(6, 78, 59, 0.2)',
    borderColor: '#065f46',
  },
  successBadgeCircle: {
    width: 40,
    height: 40,
    backgroundColor: '#10b981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  successStateTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  successStateSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});