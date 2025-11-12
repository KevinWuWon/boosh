import { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LessonCard } from '@/components/lesson-card';
import { ExerciseSection } from '@/components/exercise-section';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Id } from '@/convex/_generated/dataModel';

export default function TodayLesson() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookId = params.bookId as Id<'books'>;
  const tint = useThemeColor({}, 'tint');

  const [exerciseResponse, setExerciseResponse] = useState('');

  const book = useQuery(api.books.get, { bookId });
  const nextLesson = useQuery(api.lessons.getNextIncomplete, { bookId });
  const progress = useQuery(api.userProgress.getProgress, { bookId });
  const markComplete = useMutation(api.lessons.markComplete);

  const handleComplete = async () => {
    if (!nextLesson) return;

    try {
      await markComplete({
        lessonId: nextLesson._id,
        exerciseResponse: nextLesson.exercise ? exerciseResponse : undefined,
      });

      Alert.alert(
        'Lesson Complete!',
        'Great job! Keep up the momentum.',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Stay on the same screen - the query will automatically update
            },
          },
          {
            text: 'Back to Home',
            onPress: () => router.back(),
          },
        ]
      );

      setExerciseResponse('');
    } catch {
      Alert.alert('Error', 'Failed to mark lesson as complete');
    }
  };

  if (book === undefined || nextLesson === undefined || progress === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!nextLesson) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.content}>
          <View style={styles.completedContainer}>
            <IconSymbol name="checkmark.circle.fill" size={80} color={tint} />
            <ThemedText type="title" style={styles.completedTitle}>
              All Lessons Complete!
            </ThemedText>
            <ThemedText style={styles.completedText}>
              Congratulations! You&apos;ve completed all lessons in &quot;{book?.title}&quot;
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }
              ]}
              onPress={() => router.back()}
            >
              <ThemedText style={styles.completeButtonText}>
                Back to Home
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            {({ pressed }) => (
              <IconSymbol
                name="chevron.right"
                size={24}
                color={tint}
                style={[styles.backIcon, { opacity: pressed ? 0.5 : 1 }]}
              />
            )}
          </Pressable>
          <View style={styles.headerInfo}>
            <ThemedText type="defaultSemiBold">{book?.title}</ThemedText>
            <ThemedText style={styles.progressText}>
              {progress.completedLessons} of {progress.totalLessons} lessons
            </ThemedText>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LessonCard
            title={nextLesson.title}
            content={nextLesson.content}
            chapterNumber={nextLesson.chapterNumber}
            lessonNumber={nextLesson.lessonNumber}
          />

          {nextLesson.exercise && (
            <ExerciseSection
              exercise={nextLesson.exercise}
              onResponse={setExerciseResponse}
              initialResponse={exerciseResponse}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.completeButton,
              { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }
            ]}
            onPress={handleComplete}
          >
            <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" />
            <ThemedText style={styles.completeButtonText}>
              Complete Lesson
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  headerInfo: {
    marginLeft: 16,
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  completeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  completedTitle: {
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  completedText: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
  },
});
