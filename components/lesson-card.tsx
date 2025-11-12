import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface LessonCardProps {
  title: string;
  content: string;
  chapterNumber: number;
  lessonNumber: number;
}

export function LessonCard({
  title,
  content,
  chapterNumber,
  lessonNumber,
}: LessonCardProps) {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.lessonNumber}>
          Chapter {chapterNumber} • Lesson {lessonNumber}
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
      </View>
      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.content}>{content}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  lessonNumber: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    fontSize: 18,
    lineHeight: 28,
  },
});
