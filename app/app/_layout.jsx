import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import BottomNav from '../../components/bottomnav'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <View style={styles.container}>
      
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>

      
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
});