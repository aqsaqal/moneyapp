import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeatureSlots } from '@/features';
import { useRouter } from 'expo-router';

export default function More() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>More</Text>
        <FeatureSlots.MoreMenuItems onNavigate={(p) => router.push(p as never)} />
        <Text style={styles.placeholder}>Phase 3 screen.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08080F' },
  container: { flex: 1, padding: 24 },
  title: { color: '#EAEAF2', fontSize: 28, fontWeight: '800' },
  placeholder: { color: '#55556A', fontSize: 12, marginTop: 8 },
});
