import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Id } from '@/convex/_generated/dataModel';

// Component to display a single book with its progress
function BookCard({ bookId, title, author, onPress }: {
  bookId: Id<'books'>;
  title: string;
  author: string;
  onPress: () => void;
}) {
  const tint = useThemeColor({}, 'tint');
  const progress = useQuery(api.userProgress.getProgress, { bookId });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookCard,
        { opacity: pressed ? 0.7 : 1 }
      ]}
      onPress={onPress}
    >
      <ThemedView style={styles.cardContent}>
        <View style={styles.bookInfo}>
          <IconSymbol name="book.fill" size={40} color={tint} />
          <View style={styles.bookDetails}>
            <ThemedText type="defaultSemiBold" style={styles.bookTitle}>
              {title}
            </ThemedText>
            <ThemedText style={styles.bookAuthor}>by {author}</ThemedText>
            <View style={styles.progressContainer}>
              <ThemedText style={styles.progressText}>
                {progress?.completedLessons ?? 0} of {progress?.totalLessons ?? 0} lessons completed
              </ThemedText>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress?.percentComplete ?? 0}%`,
                      backgroundColor: tint,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

export default function Library() {
  const router = useRouter();
  const books = useQuery(api.books.list);
  const tint = useThemeColor({}, 'tint');

  const handleBookPress = (bookId: Id<'books'>) => {
    router.push(`/lesson/today?bookId=${bookId}`);
  };

  if (books === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            {({ pressed }) => (
              <IconSymbol
                name="chevron.right"
                size={24}
                color={tint}
                style={[styles.backIcon, { opacity: pressed ? 0.5 : 1 }]}
              />
            )}
          </Pressable>
          <ThemedText type="title">Library</ThemedText>
        </View>

        {books.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="book.fill" size={80} color={tint} />
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No Books Yet
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              Add your first book to get started
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <BookCard
                bookId={item._id}
                title={item.title}
                author={item.author}
                onPress={() => handleBookPress(item._id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
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
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  listContent: {
    paddingBottom: 20,
  },
  bookCard: {
    marginBottom: 16,
  },
  cardContent: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bookInfo: {
    flexDirection: 'row',
  },
  bookDetails: {
    flex: 1,
    marginLeft: 16,
  },
  bookTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
