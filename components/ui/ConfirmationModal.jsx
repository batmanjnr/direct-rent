import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions 
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { AlertCircle, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger'
}) => {
  // Color configuration mapping for the design variants
  const colors = {
    danger: {
      iconBg: '#fff1f2', // rose-50
      iconColor: '#e11d48', // rose-600
      buttonBg: '#e11d48',
    },
    warning: {
      iconBg: '#fffbeb', // amber-50
      iconColor: '#d97706', // amber-600
      buttonBg: '#d97706',
    },
    info: {
      iconBg: '#eef2ff', // primary-50
      iconColor: '#4f46e5', // primary-600
      buttonBg: '#4f46e5',
    }
  };

  const activeColors = colors[variant];

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop click-to-close */}
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.backdrop} 
          onPress={onClose} 
        />

        <Animatable.View 
          animation="zoomIn" 
          duration={300} 
          style={styles.modalContent}
        >
          <View style={styles.paddingContainer}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: activeColors.iconBg }]}>
              <AlertCircle size={32} color={activeColors.iconColor} />
            </View>

            {/* Text Content[cite: 3] */}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {/* Action Buttons[cite: 3] */}
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.confirmBtn, { backgroundColor: activeColors.buttonBg }]} 
                onPress={() => {
                  onConfirm();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Close Icon[cite: 3] */}
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeIcon}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#94a3b8" />
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // deep blue-gray overlay
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 32, // Rounded-[2rem]
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    position: 'relative',
  },
  paddingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  confirmBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  closeIcon: {
    position: 'absolute',
    top: 24,
    right: 24,
  }
});

export default ConfirmationModal;