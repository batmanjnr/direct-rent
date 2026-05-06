import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { ShieldAlert, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react-native';
// Note: skipping react-native-reanimated to avoid runtime native plugin errors in environments
// where the native module is not installed. We use plain Views for stable behavior.
import { useAuth } from '../../../context/AuthContext';
import { auth, db } from '../../../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const AdminAuth = () => {
  const { authMode, setAuthMode, setView, theme } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = theme === 'dark';

  const handleSubmit = async () => {
    if (!email || !password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      if (authMode === 'signup') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const uid = res.user.uid;
        
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          email,
          role: 'admin',
          createdAt: new Date().toISOString(),
          verificationStatus: 'verified' 
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#020617' : '#ffffff' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setView('landing')} style={styles.backButton}>
              <ArrowLeft size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <View style={styles.logoBadge}>
                <ShieldAlert size={16} color="#ffffff" />
              </View>
              <Text style={[styles.titleText, { color: isDark ? '#ffffff' : '#0f172a' }]}>Admin Portal</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>
              {authMode === 'login' ? 'Admin Login' : 'Create Admin'}
            </Text>
            <Text style={styles.heroSub}>
              {authMode === 'login' ? 'Access the management dashboard' : 'Register a new administrator account'}
            </Text>
          </View>

          {/* Mode Switcher */}
          <View style={[styles.switcher, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <TouchableOpacity 
              onPress={() => setAuthMode('login')}
              style={[styles.switchBtn, authMode === 'login' && [styles.switchBtnActive, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]]}
            >
              <Text style={[styles.switchText, authMode === 'login' ? { color: isDark ? '#ffffff' : '#0f172a' } : { color: '#94a3b8' }]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setAuthMode('signup')}
              style={[styles.switchBtn, authMode === 'signup' && [styles.switchBtnActive, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]]}
            >
              <Text style={[styles.switchText, authMode === 'signup' ? { color: isDark ? '#ffffff' : '#0f172a' } : { color: '#94a3b8' }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(127, 29, 29, 0.2)' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fee2e2' }]}>
                <AlertCircle size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Email</Text>
              <TextInput 
                value={email}
                onChangeText={setEmail}
                placeholder="admin@directrent.com"
                placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput 
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.passwordInput, { backgroundColor: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#ffffff' : '#0f172a', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              disabled={isLoading || !email || !password}
              onPress={handleSubmit}
              style={[styles.submitBtn, (isLoading || !email || !password) && styles.submitBtnDisabled]}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {authMode === 'login' ? 'Sign In' : 'Create Admin Account'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Footer */}
          <View style={styles.footer}>
            <ShieldAlert size={14} color={isDark ? '#1e293b' : '#e2e8f0'} />
            <Text style={styles.footerText}>Secure Systems Active</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backButton: { padding: 8, marginLeft: -8 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 32, height: 32, backgroundColor: '#10b981', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
  heroSection: { alignItems: 'center', marginBottom: 32 },
  heroTitle: { fontSize: 28, fontWeight: '900', marginBottom: 8, letterSpacing: -1 },
  heroSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', fontWeight: '500' },
  switcher: { flexDirection: 'row', padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 32 },
  switchBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  switchBtnActive: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  switchText: { fontSize: 14, fontWeight: '700' },
  form: { gap: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  errorText: { flex: 1, color: '#ef4444', fontSize: 13, fontWeight: '600' },
  inputGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 56, borderRadius: 16, borderHorizontal: 16, paddingHorizontal: 16, fontSize: 15, fontWeight: '500', borderWidth: 1 },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeIcon: { position: 'absolute', right: 16, top: 18 },
  submitBtn: { backgroundColor: '#10b981', height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10, elevation: 4, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  submitBtnDisabled: { backgroundColor: '#e2e8f0', elevation: 0 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 48 },
  footerText: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 },
});

export default AdminAuth;