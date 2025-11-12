import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useMutation, useQuery } from 'convex/react';
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBookId, setUploadedBookId] = useState<Id<'books'> | null>(null);

  const createBook = useMutation(api.books.create);
  const generateUploadUrl = useMutation(api.books.generateUploadUrl);
  const regenerateLessons = useMutation(api.books.regenerateLessons);
  const processingStatus = useQuery(
    uploadedBookId ? api.books.getProcessingStatus : 'skip',
    uploadedBookId ? { bookId: uploadedBookId } : 'skip'
  );

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

    if (!selectedFile) {
      Alert.alert('Error', 'Please select a PDF file');
      return;
    }

    setIsUploading(true);

    try {
      // Upload PDF to Convex storage
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();

      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: blob,
      });

      const { storageId } = await upload.json();

      // Create book and trigger AI processing
      const bookId = await createBook({
        title: bookTitle,
        author: bookAuthor,
        uploadedFileId: storageId,
      });

      // Show processing status
      setUploadedBookId(bookId);
      setBookTitle('');
      setBookAuthor('');
      setSelectedFile(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload book');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setUploadedBookId(null);
    setBookTitle('');
    setBookAuthor('');
    setSelectedFile(null);
  };

  const handleRegenerateLessons = async () => {
    if (!uploadedBookId) return;

    try {
      await regenerateLessons({ bookId: uploadedBookId });
      Alert.alert('Success', 'Regenerating lessons. This may take a few minutes.');
    } catch (error) {
      Alert.alert('Error', 'Failed to regenerate lessons');
      console.error(error);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Preparing upload...';
      case 'uploading':
        return 'Uploading to AI service...';
      case 'processing':
        return 'Extracting lessons...';
      case 'ready':
        return 'Complete!';
      case 'error':
        return 'Error occurred';
      default:
        return status;
    }
  };

  // Show processing status if book is being processed
  if (uploadedBookId && processingStatus) {
    const isComplete = processingStatus.status === 'ready';
    const isError = processingStatus.status === 'error';

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
            <ThemedText type="title">Processing Book</ThemedText>
          </View>

          <View style={styles.statusContainer}>
            {!isComplete && !isError && (
              <ActivityIndicator size="large" color={tint} style={styles.spinner} />
            )}

            {isComplete && (
              <IconSymbol name="checkmark.circle.fill" size={80} color={tint} />
            )}

            {isError && (
              <IconSymbol name="exclamationmark.triangle.fill" size={80} color="#ff3b30" />
            )}

            <ThemedText type="subtitle" style={styles.statusTitle}>
              {getStatusText(processingStatus.status)}
            </ThemedText>

            {processingStatus.lessonsGenerated > 0 && (
              <ThemedText style={styles.statusDetail}>
                {processingStatus.lessonsGenerated} lessons generated
              </ThemedText>
            )}

            {isError && processingStatus.processingError && (
              <ThemedText style={[styles.statusDetail, styles.errorText]}>
                {processingStatus.processingError}
              </ThemedText>
            )}

            {isComplete && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: tint, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => router.back()}
              >
                <ThemedText style={styles.actionButtonText}>View Books</ThemedText>
              </Pressable>
            )}

            {(isComplete || isError) && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: tint, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleRegenerateLessons}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: tint }]}>
                  Regenerate Lessons
                </ThemedText>
              </Pressable>
            )}

            {(isComplete || isError) && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: tint, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleReset}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: tint }]}>
                  Upload Another Book
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  // Show upload form
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
          <ThemedText type="title">Add Book</ThemedText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
            editable={!isUploading}
          />

          <ThemedText style={styles.label}>Author *</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor, borderColor }]}
            value={bookAuthor}
            onChangeText={setBookAuthor}
            placeholder="Enter author name"
            placeholderTextColor={textColor + '80'}
            editable={!isUploading}
          />

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            PDF File *
          </ThemedText>

          <ThemedText style={styles.helperText}>
            Upload a PDF and AI will automatically extract daily lessons from it.
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.uploadButton,
              { borderColor: tint, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={pickDocument}
            disabled={isUploading}
          >
            <IconSymbol name="plus.circle.fill" size={24} color={tint} />
            <ThemedText style={[styles.uploadButtonText, { color: tint }]}>
              {selectedFile ? selectedFile.name : 'Select PDF File'}
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              {
                backgroundColor: tint,
                opacity: isUploading || !selectedFile ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
            onPress={handleCreateBook}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.createButtonText}>Upload & Generate Lessons</ThemedText>
            )}
          </Pressable>
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
  helperText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
  },
  statusTitle: {
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusDetail: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 16,
    lineHeight: 24,
  },
  errorText: {
    color: '#ff3b30',
    opacity: 1,
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
