import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Id } from '@/convex/_generated/dataModel';

export default function AdminUpload() {
  const router = useRouter();
  const tint = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor(
    { light: '#f5f5f5', dark: '#2a2a2a' },
    'background'
  );
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');

  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
  } | null>(null);

  // For manual lesson entry
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<Id<'books'> | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonExercise, setLessonExercise] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [lessonNumber, setLessonNumber] = useState('1');

  const createBook = useMutation(api.books.create);
  const createLesson = useMutation(api.lessons.create);
  const generateUploadUrl = useMutation(api.books.generateUploadUrl);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          uri: file.uri,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleCreateBook = async () => {
    if (!bookTitle.trim() || !bookAuthor.trim()) {
      Alert.alert('Error', 'Please enter book title and author');
      return;
    }

    try {
      let uploadedFileId: Id<'_storage'> | undefined;

      // If a file was selected, upload it
      if (selectedFile) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const upload = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: blob,
        });

        const { storageId } = await upload.json();
        uploadedFileId = storageId;
      }

      const bookId = await createBook({
        title: bookTitle,
        author: bookAuthor,
        uploadedFileId,
      });

      Alert.alert(
        'Success',
        'Book created! Now add lessons manually.',
        [
          {
            text: 'Add Lessons',
            onPress: () => {
              setSelectedBookId(bookId);
              setShowLessonForm(true);
              setBookTitle('');
              setBookAuthor('');
              setSelectedFile(null);
            },
          },
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create book');
      console.error(error);
    }
  };

  const handleCreateLesson = async () => {
    if (!selectedBookId || !lessonTitle.trim() || !lessonContent.trim()) {
      Alert.alert('Error', 'Please enter lesson title and content');
      return;
    }

    try {
      await createLesson({
        bookId: selectedBookId,
        chapterNumber: parseInt(chapterNumber) || 1,
        lessonNumber: parseInt(lessonNumber) || 1,
        title: lessonTitle,
        content: lessonContent,
        exercise: lessonExercise.trim() || undefined,
      });

      Alert.alert('Success', 'Lesson created!', [
        {
          text: 'Add Another',
          onPress: () => {
            setLessonTitle('');
            setLessonContent('');
            setLessonExercise('');
            setLessonNumber(String(parseInt(lessonNumber) + 1));
          },
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create lesson');
      console.error(error);
    }
  };

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
          <ThemedText type="title">
            {showLessonForm ? 'Add Lessons' : 'Add Book'}
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!showLessonForm ? (
            <>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Book Information
              </ThemedText>

              <ThemedText style={styles.label}>Title *</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
                value={bookTitle}
                onChangeText={setBookTitle}
                placeholder="Enter book title"
                placeholderTextColor={textColor + '80'}
              />

              <ThemedText style={styles.label}>Author *</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
                value={bookAuthor}
                onChangeText={setBookAuthor}
                placeholder="Enter author name"
                placeholderTextColor={textColor + '80'}
              />

              <ThemedText type="subtitle" style={styles.sectionTitle}>
                PDF File (Optional)
              </ThemedText>

              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  { borderColor: tint, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={pickDocument}
              >
                <IconSymbol name="plus.circle.fill" size={24} color={tint} />
                <ThemedText style={[styles.uploadButtonText, { color: tint }]}>
                  {selectedFile ? selectedFile.name : 'Select PDF File'}
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.createButton,
                  { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={handleCreateBook}
              >
                <ThemedText style={styles.createButtonText}>Create Book</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Lesson Information
              </ThemedText>

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <ThemedText style={styles.label}>Chapter #</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
                    value={chapterNumber}
                    onChangeText={setChapterNumber}
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={textColor + '80'}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <ThemedText style={styles.label}>Lesson #</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
                    value={lessonNumber}
                    onChangeText={setLessonNumber}
                    placeholder="1"
                    keyboardType="number-pad"
                    placeholderTextColor={textColor + '80'}
                  />
                </View>
              </View>

              <ThemedText style={styles.label}>Title *</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
                value={lessonTitle}
                onChangeText={setLessonTitle}
                placeholder="Enter lesson title"
                placeholderTextColor={textColor + '80'}
              />

              <ThemedText style={styles.label}>Content *</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { color: textColor, backgroundColor, borderColor },
                ]}
                value={lessonContent}
                onChangeText={setLessonContent}
                placeholder="Enter lesson content"
                placeholderTextColor={textColor + '80'}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <ThemedText style={styles.label}>Exercise (Optional)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { color: textColor, backgroundColor, borderColor },
                ]}
                value={lessonExercise}
                onChangeText={setLessonExercise}
                placeholder="Enter exercise prompt"
                placeholderTextColor={textColor + '80'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.createButton,
                  { backgroundColor: tint, opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={handleCreateLesson}
              >
                <ThemedText style={styles.createButtonText}>Create Lesson</ThemedText>
              </Pressable>
            </>
          )}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
});
