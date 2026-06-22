import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native'; // 画面が切り替わったことを検知するフック

// メモデータの型定義
interface MemoItem {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  createdAt: string;
}

export default function ExploreScreen() {
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const isFocused = useIsFocused(); // 撮影画面からこの画面に戻ってきたらtrueになる

  // 端末（AsyncStorage）から保存されたメモを読み込む関数
  const loadMemos = async () => {
    try {
      const savedMemos = await AsyncStorage.getItem('dictionary_memos');
      if (savedMemos) {
        setMemos(JSON.parse(savedMemos));
      }
    } catch (error) {
      console.error('メモの読み込みに失敗しました:', error);
    }
  };

  //特定のメモを1件削除する関数
  const deleteMemo = async (id: string) => {
    Alert.alert('メモの削除', 'このメモを削除してもよろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const filteredMemos = memos.filter((item) => item.id !== id);
          setMemos(filteredMemos);
          await AsyncStorage.setItem('dictionary_memos', JSON.stringify(filteredMemos));
        },
      },
    ]);
  };

  // 画面が表示されるたびに、最新の保存データを読み込む
  useEffect(() => {
    if (isFocused) {
      loadMemos();
    }
  }, [isFocused]);

  // リストの1マス（項目別カード）のデザイン
  const renderCard = ({ item }: { item: MemoItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.dateText}>{item.createdAt}</Text>
        {/* 削除ボタン */}
        <TouchableOpacity onPress={() => deleteMemo(item.id)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>削除</Text>
        </TouchableOpacity>
      </View>

      {/* 項目：元の文字 */}
      <View style={styles.section}>
        <Text style={styles.label}>【元の文字】</Text>
        <Text style={styles.wordText}>{item.word}</Text>
      </View>

      {/* 項目：読み方 */}
      <View style={styles.section}>
        <Text style={styles.label}>【読み方】</Text>
        <Text style={styles.readingText}>{item.reading}</Text>
      </View>

      {/* 項目：意味 */}
      <View style={styles.section}>
        <Text style={styles.label}>【意味・概要】</Text>
        <Text style={styles.meaningText}>{item.meaning}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>保存された辞書メモ</Text>
      {memos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>撮影して検索した言葉が{"\n"}ここに自動で保存されます。</Text>
        </View>
      ) : (
        <FlatList
          data={memos}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 2,
  },
  wordText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
  readingText: {
    fontSize: 16,
    color: '#444',
  },
  meaningText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
  },
});