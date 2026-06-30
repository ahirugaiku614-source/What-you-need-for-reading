import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface MemoItem {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  createdAt: string;
  tags?: string[]; // タグ保存用の配列
}

// 画面切り替え用のタブの型
type FilterTab = 'all' | 'dictionary' | 'text';

export default function ExploreScreen() {
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null); // 選択中の検索タグ
  const [inputText, setInputText] = useState(''); // タグ追加用の入力テキスト
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null); // タグ編集中のメモID
  
  const isFocused = useIsFocused();

  // 端末からメモを読み込む
  const loadMemos = async () => {
    try {
      const savedMemos = await AsyncStorage.getItem('dictionary_memos');
      if (savedMemos) {
        const parsed: MemoItem[] = JSON.parse(savedMemos);
        // 過去のタグがない古いデータにも空配列を入れて安全にする
        const updated = parsed.map(item => ({
          ...item,
          tags: item.tags || []
        }));
        setMemos(updated);
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

  // タグを追加する関数
  const addTag = async (memoId: string) => {
    if (!inputText.trim()) return;
    const newTag = inputText.trim();

    const updatedMemos = memos.map((item) => {
      if (item.id === memoId) {
        const currentTags = item.tags || [];
        if (currentTags.includes(newTag)) {
          Alert.alert('通知', 'そのタグは既に登録されています。');
          return item;
        }
        return { ...item, tags: [...currentTags, newTag] };
      }
      return item;
    });

    setMemos(updatedMemos);
    await AsyncStorage.setItem('dictionary_memos', JSON.stringify(updatedMemos));
    setInputText('');
    setActiveMemoId(null);
  };

  // タグを削除する関数
  const removeTag = async (memoId: string, tagToRemove: string) => {
    const updatedMemos = memos.map((item) => {
      if (item.id === memoId) {
        return {
          ...item,
          tags: (item.tags || []).filter((t) => t !== tagToRemove),
        };
      }
      return item;
    });

    setMemos(updatedMemos);
    await AsyncStorage.setItem('dictionary_memos', JSON.stringify(updatedMemos));
  };

  useEffect(() => {
    if (isFocused) {
      loadMemos();
    }
  }, [isFocused]);

  // 全データから存在するすべてのタグを重複なく抽出（タグ検索バー用）
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    memos.forEach((item) => {
      if (item.tags) {
        item.tags.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet);
  }, [memos]);

  // 選ばれているタブ ＆ タグに応じて、表示するメモを仕分ける（フィルター処理）
  const getFilteredMemos = () => {
    let result = memos;

    //  上部タブの切り替えフィルター
    if (activeTab === 'dictionary') {
      result = result.filter(item => item.word !== '（文章抽出）');
    } else if (activeTab === 'text') {
      result = result.filter(item => item.word === '（文章抽出）');
    }

    //タグ検索のフィルター（選択されている場合）
    if (selectedTag) {
      result = result.filter(item => item.tags && item.tags.includes(selectedTag));
    }

    return result;
  };

  // カード（1マス）のレイアウト
  const renderCard = ({ item }: { item: MemoItem }) => {
    const isTextMode = item.word === '（文章抽出）';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isTextMode ? styles.badgeText : styles.badgeDict]}>
            <Text style={styles.badgeLabel}>{isTextMode ? '文章クリップ' : '辞書検索'}</Text>
          </View>
          <Text style={styles.dateText}>{item.createdAt}</Text>
          <TouchableOpacity onPress={() => deleteMemo(item.id)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </TouchableOpacity>
        </View>

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

        <View style={styles.section}>
          <Text style={styles.label}>{isTextMode ? '【抜き出した文章】' : '【意味・概要】'}</Text>
          <Text style={styles.meaningText}>{item.meaning}</Text>
        </View>

        {/*タグ表示・編集エリア */}
        <View style={styles.tagSection}>
          <View style={styles.tagContainer}>
            {(item.tags || []).map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(item.id, tag)} style={styles.deleteTagButton}>
                  <Text style={styles.deleteTagButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            {activeMemoId !== item.id ? (
              <TouchableOpacity style={styles.addTagButton} onPress={() => setActiveMemoId(item.id)}>
                <Text style={styles.addTagButtonText}>＋ タグ追加</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="タグ名"
                  placeholderTextColor="#999"
                  value={inputText}
                  onChangeText={setInputText}
                  autoFocus
                />
                <TouchableOpacity style={styles.saveTagButton} onPress={() => addTag(item.id)}>
                  <Text style={styles.saveTagButtonText}>追加</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelTagButton} onPress={() => { setActiveMemoId(null); setInputText(''); }}>
                  <Text style={styles.cancelTagButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>保存された履歴・メモ</Text>
      <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
                <Ionicons name="chevron-back" size={15} color="#1A365D" />
                <Text style={styles.backButtonText}>ホーム</Text>
              </TouchableOpacity>
            </View>

      {/* 元々のタブメニュー */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]} 
          onPress={() => { setActiveTab('all'); setSelectedTag(null); }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.activeTabButtonText]}>すべて</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'dictionary' && styles.activeTabButton]} 
          onPress={() => { setActiveTab('dictionary'); setSelectedTag(null); }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'dictionary' && styles.activeTabButtonText]}>辞書・漢字</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'text' && styles.activeTabButton]} 
          onPress={() => { setActiveTab('text'); setSelectedTag(null); }}
        >
          <Text style={[styles.tabButtonText, activeTab === 'text' && styles.activeTabButtonText]}>文章抽出</Text>
        </TouchableOpacity>
      </View>

      {/* タグ絞り込み検索バー */}
      {allTags.length > 0 && (
        <View style={styles.searchTagSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagCarousel}>
            <TouchableOpacity
              style={[styles.filterTagButton, !selectedTag && styles.activeFilterTag]}
              onPress={() => setSelectedTag(null)}
            >
              <Text style={[styles.filterTagText, !selectedTag && styles.activeFilterTagText]}>すべて表示</Text>
            </TouchableOpacity>
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.filterTagButton, selectedTag === tag && styles.activeFilterTag]}
                onPress={() => setSelectedTag(tag)}
              >
                <Text style={[styles.filterTagText, selectedTag === tag && styles.activeFilterTagText]}>#{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* フィルターをかけた後のリストを表示 */}
      {getFilteredMemos().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {selectedTag ? `「#${selectedTag}」の履歴は\nまだありません。` : 'このカテゴリーの履歴は\nまだありません。'}
          </Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    marginHorizontal: 15,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
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
    color: '#007aff',
  },
  
  /*  タグ検索バー関連のスタイル */
  searchTagSection: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  tagCarousel: {
    flexDirection: 'row',
  },
  filterTagButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeFilterTag: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  filterTagText: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeFilterTagText: {
    color: '#fff',
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

  /* 各カード内タグ機能のスタイル */
  tagSection: {
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    paddingTop: 10,
    marginTop: 5,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    color: '#007aff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteTagButton: {
    marginLeft: 6,
    backgroundColor: '#d0d7de',
    borderRadius: 8,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteTagButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  addTagButton: {
    backgroundColor: '#eee',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  addTagButtonText: {
    color: '#555',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    color: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    width: 90,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveTagButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 4,
  },
  saveTagButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cancelTagButton: {
    backgroundColor: '#eee',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cancelTagButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
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
   header:{
    position: 'absolute',    //映像の上に浮かせる
    top: 48,                 // スマホ上部のステータスバーを避ける
    left: 5,
    zIndex: 40,              //カメラ映像よりも手前に持ってくる
    backgroundColor: 'rgba(244, 244, 244, 0.81)', 
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 6,
  },
  backButton:{
    flexDirection:'row',
    alignItems:'center',
  },
  backButtonText:{
    fontSize:16,
    fontWeight:'bold',
    color:'#1A365D',
    marginLeft:5
  },

});