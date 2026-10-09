import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { LocalizedText as Text } from '../../i18n/LocalizedText';
import { useLanguage } from '../../i18n/LanguageContext';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to Medi-Queue',
    description: 'The smartest way to manage your hospital visits. Say goodbye to long waiting lines!',
    icon: 'medical',
    color: '#0a6e7e'
  },
  {
    id: '2',
    title: 'Live Queue Tracking',
    description: 'Track your position in the OPD queue in real-time from anywhere. We will notify you when it\'s your turn.',
    icon: 'time',
    color: '#0D9488'
  },
  {
    id: '3',
    title: 'Digital Health Records',
    description: 'Access all your past prescriptions and medical history right inside the app, securely.',
    icon: 'document-text',
    color: '#0284C7'
  }
];

export default function OnboardingScreen() {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finish Onboarding
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          await AsyncStorage.setItem(`onboarding_${user._id}`, 'true');
        }
        router.replace('/(patient)' as any);
      } catch (e) {
        router.replace('/(patient)' as any);
      }
    }
  };

  const handleSkip = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        await AsyncStorage.setItem(`onboarding_${user._id}`, 'true');
      }
      router.replace('/(patient)' as any);
    } catch (e) {
      router.replace('/(patient)' as any);
    }
  };

  const renderItem = ({ item }: any) => {
    return (
      <View style={styles.slide}>
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon} size={100} color={Colors.white} />
        </View>
        <Text style={styles.title}>{t(item.title)}</Text>
        <Text style={styles.description}>{t(item.description)}</Text>
      </View>
    );
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.activeDot
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <LanguageSwitcher tone="light" />
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>{t('Skip')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.footer}>
        {renderDots()}
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? t('Get Started') : t('Next')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  skipText: {
    fontSize: 16,
    color: Colors.textMedium,
    fontWeight: '600',
  },
  slide: {
    width,
    alignItems: 'center',
    paddingTop: height * 0.1,
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: Colors.textMedium,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 25,
  },
  button: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
