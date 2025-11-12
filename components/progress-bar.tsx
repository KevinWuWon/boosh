import { View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
}

export function ProgressBar({ current, total, showLabel = true }: ProgressBarProps) {
  const tint = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <View style={styles.container}>
      {showLabel && (
        <ThemedText style={styles.label}>
          {current} of {total} lessons completed
        </ThemedText>
      )}
      <View style={[styles.track, { backgroundColor: backgroundColor }]}>
        <View
          style={[
            styles.fill,
            { width: `${percentage}%`, backgroundColor: tint }
          ]}
        />
      </View>
      <ThemedText style={styles.percentage}>{percentage}%</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
});
