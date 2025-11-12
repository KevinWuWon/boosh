import { View, Pressable, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ProgressBar } from '@/components/progress-bar';

interface BookListItemProps {
  title: string;
  author: string;
  completedLessons: number;
  totalLessons: number;
  onPress: () => void;
}

export function BookListItem({
  title,
  author,
  completedLessons,
  totalLessons,
  onPress,
}: BookListItemProps) {
  const tint = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'background');

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
      <ThemedView style={[styles.container, { borderColor, opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.iconContainer}>
          <IconSymbol name="book.fill" size={40} color={tint} />
        </View>
        <View style={styles.content}>
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText style={styles.author}>by {author}</ThemedText>
          <View style={styles.progressContainer}>
            <ProgressBar
              current={completedLessons}
              total={totalLessons}
              showLabel={false}
            />
          </View>
        </View>
        <IconSymbol name="chevron.right" size={24} color={tint} />
      </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
  },
  author: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 4,
  },
});
