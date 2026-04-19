import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import SVGIcon from './SVGIcon';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web') return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Show prompt if on iOS and not already installed
    if (isIOS && !isStandalone) {
      const lastPrompt = localStorage.getItem('pwa_prompt_dismissed');
      const now = new Date().getTime();
      
      // Only show if not dismissed or dismissed more than 7 days ago
      if (!lastPrompt || now - parseInt(lastPrompt) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', new Date().getTime().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <Modal
      transparent={true}
      visible={showPrompt}
      animationType="slide"
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Install App</ThemedText>
            <TouchableOpacity onPress={handleDismiss}>
              <SVGIcon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ThemedText style={styles.body}>
            Install this app on your home screen for a better experience.
          </ThemedText>

          <View style={styles.instructions}>
            <View style={styles.step}>
              <ThemedText style={styles.stepText}>1. Tap the Share button</ThemedText>
              <SVGIcon name="share" size={24} color="#007AFF" />
            </View>
            <View style={styles.step}>
              <ThemedText style={styles.stepText}>2. Select 'Add to Home Screen'</ThemedText>
              <SVGIcon name="add-circle" size={24} color="#007AFF" />
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleDismiss}>
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  body: {
    marginBottom: 20,
    opacity: 0.8,
  },
  instructions: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  stepText: {
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
