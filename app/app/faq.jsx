import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  ChevronLeft,
  HelpCircle,
  ChevronDown,
  Search,
  ShieldCheck,
  UserSearch,
  MessageSquare,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ = () => {
  const { setActiveTab } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      category: "General",
      icon: <HelpCircle size={16} color="#0284c7" />,
      questions: [
        {
          q: "What is DirectRent?",
          a: "DirectRent is a secure platform for finding rentals in Nigeria. We prioritize user safety through verified identities and secure communication channels."
        },
        {
          q: "Is it free to use?",
          a: "Searching for rentals is free. Agents and landlords may pay a small fee to boost their listings or access premium features."
        }
      ]
    },
    {
      category: "Safety",
      icon: <ShieldCheck size={16} color="#0284c7" />,
      questions: [
        {
          q: "How do I know a listing is safe?",
          a: "Look for the 'Verified' badge on agent profiles and listings. We manually review high-risk listings and require identity verification for all posters."
        },
        {
          q: "Should I pay before inspection?",
          a: "NEVER pay for a property before seeing it physically. DirectRent will never ask you to transfer money to an escrow account outside the platform."
        }
      ]
    },
    {
      category: "Communication",
      icon: <MessageSquare size={16} color="#0284c7" />,
      questions: [
        {
          q: "How do I contact agents?",
          a: "Use the built-in chat feature. This keeps your communication secure and allows us to step in if there's a dispute."
        }
      ]
    }
  ];

  const toggleAccordion = (idx) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIdx(openIdx === idx ? null : idx);
  };

  const allQuestions = faqs.flatMap(cat => cat.questions);
  const filteredQuestions = allQuestions.filter(f => 
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setActiveTab('profile')}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput 
            placeholder="Search for answers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>

        {searchQuery ? (
          <View style={styles.listContainer}>
            {filteredQuestions.map((faq, idx) => (
              <View key={idx} style={styles.staticCard}>
                <Text style={styles.questionText}>{faq.q}</Text>
                <Text style={styles.answerText}>{faq.a}</Text>
              </View>
            ))}
            {filteredQuestions.length === 0 && (
              <Text style={styles.noResults}>No results found</Text>
            )}
          </View>
        ) : (
          faqs.map((category, catIdx) => (
            <View key={catIdx} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryIcon}>{category.icon}</View>
                <Text style={styles.categoryTitle}>{category.category}</Text>
              </View>
              
              {category.questions.map((faq, idx) => {
                const globalIdx = catIdx * 10 + idx;
                const isOpen = openIdx === globalIdx;
                return (
                  <View key={idx} style={[styles.accordionCard, isOpen && styles.activeCard]}>
                    <TouchableOpacity 
                      onPress={() => toggleAccordion(globalIdx)}
                      style={styles.accordionHeader}
                    >
                      <Text style={[styles.questionText, isOpen && styles.activeText]}>{faq.q}</Text>
                      <ChevronDown 
                        size={18} 
                        color={isOpen ? "#0284c7" : "#94a3b8"} 
                        style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                      />
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.accordionContent}>
                        <View style={styles.answerInner}>
                          <Text style={styles.answerText}>{faq.a}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}

        
        <View style={styles.ctaCard}>
          <View style={styles.ctaIconBg}>
            <UserSearch size={32} color="#3b82f6" />
          </View>
          <Text style={styles.ctaTitle}>Still have questions?</Text>
          <Text style={styles.ctaSubtitle}>Can't find the answer you're looking for? Reach out to our friendly team.</Text>
          <TouchableOpacity style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Get in Touch</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  scrollContent: { padding: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, borderWidth: 2, borderColor: '#f1f5f9', marginBottom: 24 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, height: 56, fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  categorySection: { marginBottom: 24 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  categoryIcon: { backgroundColor: '#f0f9ff', padding: 6, borderRadius: 8, marginRight: 8 },
  categoryTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  accordionCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  activeCard: { borderColor: 'rgba(2, 132, 199, 0.2)', backgroundColor: '#fff' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  questionText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 8 },
  activeText: { color: '#0284c7' },
  accordionContent: { paddingHorizontal: 16, paddingBottom: 16 },
  answerInner: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  answerText: { fontSize: 13, color: '#64748b', lineHeight: 20, fontWeight: '500' },
  ctaCard: { backgroundColor: 'white', padding: 32, borderRadius: 40, alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  ctaIconBg: { width: 64, height: 64, backgroundColor: '#eff6ff', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  ctaTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  ctaSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  ctaButton: { backgroundColor: '#0f172a', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 },
  ctaButtonText: { color: 'white', fontWeight: '900', fontSize: 14 },
  noResults: { textAlign: 'center', color: '#94a3b8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 40 },
  staticCard: { backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' }
});

export default FAQ;