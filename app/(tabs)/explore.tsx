import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';

interface MemoItem {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  createdAt: string;
}

// 画面切り替え用のタブの型
type FilterTab = 'all' | 'dictionary' | 'text';

export default function ExploreScreen() {
  const [memos, setMemos] = useState<MemoItem[]>([]);
  // 現在どのタブが選ばれているかを管理する状態（初期値は 'all'）
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const isFocused = useIsFocused();

  // 端末からメモを読み込む
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

  // メモを削除する
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

  useEffect(() => {
    if (isFocused) {
      loadMemos();
    }
  }, [isFocused]);

  // 選ばれているタブに応じて、表示するメモを仕分ける（フィルター処理）
  const getFilteredMemos = () => {
    if (activeTab === 'dictionary') {
      // 単語検索・漢字読み方モードで保存したもの
      return memos.filter(item => item.word !== '（文章抽出）');
    }
    if (activeTab === 'text') {
      // 文章抽出モードで保存したもの
      return memos.filter(item => item.word === '（文章抽出）');
    }
    return memos; // 'all' の場合はすべて表示
  };

  // カード（1マス）のレイアウト
  const renderCard = ({ item }: { item: MemoItem }) => {
    const isTextMode = item.word === '（文章抽出）';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {/* 文章か単語かでバッジの色や文字を変える */}
          <View style={[styles.badge, isTextMode ? styles.badgeText : styles.badgeDict]}>
            <Text style={styles.badgeLabel}>{isTextMode ? '文章クリップ' : '辞書検索'}</Text>
          </View>
          <Text style={styles.dateText}>{item.createdAt}</Text>
          <TouchableOpacity onPress={() => deleteMemo(item.id)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </TouchableOpacity>
        </View>

        {/* 文章抽出ではない場合のみ「元の文字」と「読み方」を表示する */}
        {!isTextMode && (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>【元の文字】</Text>
              <Text style={styles.wordText}>{item.word}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>【読み方】</Text>
              <Text style={styles.readingText}>{item.reading}</Text>
            </View>
          </>
        )}

        {/* 意味・中身の表示 */}
        <View style={styles.section}>
          <Text style={styles.label}>{isTextMode ? '【抜き出した文章】' : '【意味・概要】'}</Text>
          <Text style={styles.meaningText}>{item.meaning}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>保存された履歴・メモ</Text>

      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]} 
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.activeTabButtonText]}>すべて</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'dictionary' && styles.activeTabButton]} 
          onPress={() => setActiveTab('dictionary')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'dictionary' && styles.activeTabButtonText]}>辞書・漢字</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'text' && styles.activeTabButton]} 
          onPress={() => setActiveTab('text')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'text' && styles.activeTabButtonText]}>文章抽出</Text>
        </TouchableOpacity>
      </View>

      {/* フィルターをかけた後のリストを表示 */}
      {getFilteredMemos().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>このカテゴリーの履歴は{"\n"}まだありません。</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredMemos()}
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
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  /*タブバー全体のコンテナ */
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    marginHorizontal: 15,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
  },
  /*通常のタブボタン */
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  /*選択されているアクティブなタブボタン */
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666',
  },
  activeTabButtonText: {
    color: '#007aff', // アクティブな時は青文字に
  },
  listContainer: {
    padding: 15,
    paddingTop: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
    marginBottom: 12,
  },
  /*種別がすぐわかるバッジスタリイング */
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeDict: {
    backgroundColor: '#e1f0ff',
  },
  badgeText: {
    backgroundColor: '#e6f4ea',
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#444',
  },
  dateText: {
    fontSize: 12,
    color: '#bbb',
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#ffebeb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#007aff',
    marginBottom: 3,
  },
  wordText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#111',
  },
  readingText: {
    fontSize: 15,
    color: '#333',
  },
  meaningText: {
    fontSize: 14,
    color: '#555',
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
    fontSize: 15,
    lineHeight: 22,
  },
});