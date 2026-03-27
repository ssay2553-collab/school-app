import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import SVGIcon from '../components/SVGIcon';
import { SCHOOL_CONFIG } from '../constants/Config';

export default function NotFoundScreen() {
  const primary = SCHOOL_CONFIG.primaryColor;

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found' }} />
      <View style={styles.container}>
        <SVGIcon name="alert-circle-outline" size={80} color={primary} />
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Text style={styles.subtitle}>The page you are looking for may have been moved or does not exist.</Text>

        <Link href="/" asChild>
          <TouchableOpacity style={[styles.button, { backgroundColor: primary }]}>
            <Text style={styles.buttonText}>Go to Home Screen</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
