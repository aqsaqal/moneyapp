import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_NAME, FLAVOR, PRIMARY_COLOR } from '@/constants/flavor';
import { FeatureSlots } from '@/features';

export default function Home() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.brand}>{APP_NAME}</Text>
        <Text style={styles.sub}>Flavor: {FLAVOR}</Text>
        <View style={[styles.accentBar, { backgroundColor: PRIMARY_COLOR }]} />
        <FeatureSlots.HomeHeaderExtras />
        <FeatureSlots.HomeExtras />
        <Text style={styles.placeholder}>Phase 1 scaffold ready. UI in Phase 3.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#08080F' },
  container: { flex: 1, padding: 24, gap: 16 },
  brand: { color: '#EAEAF2', fontSize: 32, fontWeight: '800' },
  sub: { color: '#8888AA', fontSize: 14 },
  accentBar: { height: 4, width: 64, borderRadius: 2 },
  placeholder: { color: '#55556A', fontSize: 12, marginTop: 24 },
});
