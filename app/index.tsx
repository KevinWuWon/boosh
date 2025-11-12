import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BookItemWithProgress } from '@/components/book-item-with-progress';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Id } from '@/convex/_generated/dataModel';

export default function Index() {
  const router = useRouter();
  const books = useQuery(api.books.list);
  const tint = useThemeColor({}, 'tint');

  const handleBookPress = (bookId: Id<'books'>) => {
    router.push(`/lesson/today?bookId=${bookId}`);
  };

  const handleLibraryPress = () => {
    router.push('/library');
  };

  const handleAdminPress = () => {
    router.push('/admin/upload');
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
          <ThemedText type="title" style={styles.title}>
            Daily Lessons
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Continue your learning journey
          </ThemedText>
        </View>

        {books.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="book.fill" size={80} color={tint} />
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No Books Yet
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              Add your first book to get started with daily lessons
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.adminButton,
                { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }
              ]}
              onPress={handleAdminPress}
            >
              <ThemedText style={styles.adminButtonText}>Add Book</ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <BookItemWithProgress
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

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.footerButton,
              { opacity: pressed ? 0.5 : 1 }
            ]}
            onPress={handleLibraryPress}
          >
            <IconSymbol name="list.bullet" size={20} color={tint} />
            <ThemedText style={styles.footerButtonText}>Library</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.footerButton,
              { opacity: pressed ? 0.5 : 1 }
            ]}
            onPress={handleAdminPress}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={tint} />
            <ThemedText style={styles.footerButtonText}>Add Book</ThemedText>
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
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: 20,
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
    marginBottom: 24,
  },
  adminButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerButtonText: {
    fontSize: 16,
  },
});
