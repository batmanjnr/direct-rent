import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Home, User, Layout } from 'lucide-react-native';

const SafeImage = ({ 
  src, 
  alt, 
  style, 
  fallbackType = 'house',
  ...props 
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  // Select fallback icon based on type
  const renderFallbackIcon = () => {
    const iconProps = { size: 32, color: '#cbd5e1', opacity: 0.3 };
    switch (fallbackType) {
      case 'avatar': return <User {...iconProps} />;
      case 'room': return <Layout {...iconProps} />;
      default: return <Home {...iconProps} />;
    }
  };

  if (error || !src) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        {renderFallbackIcon()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: src }}
        style={[styles.image, style, loading && styles.hiddenImage]}
        onError={handleImageError}
        onLoad={handleImageLoad}
        {...props}
      />
      
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator color="#0284c7" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hiddenImage: {
    opacity: 0,
  },
  loadingOverlay: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SafeImage;