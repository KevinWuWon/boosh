import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { BookListItem } from '@/components/book-list-item';
import { Id } from '@/convex/_generated/dataModel';

interface BookItemWithProgressProps {
  bookId: Id<'books'>;
  title: string;
  author: string;
  onPress: () => void;
}

export function BookItemWithProgress({
  bookId,
  title,
  author,
  onPress,
}: BookItemWithProgressProps) {
  const progress = useQuery(api.userProgress.getProgress, { bookId });

  return (
    <BookListItem
      title={title}
      author={author}
      completedLessons={progress?.completedLessons ?? 0}
      totalLessons={progress?.totalLessons ?? 0}
      onPress={onPress}
    />
  );
}
