import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, Button, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MemoScreen() {
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [list, setList] = useState<{ word: string; meaning: string; }[]>([]);

  // 1. 読み込み機能
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await AsyncStorage.getItem('myWords');
    if (data) setList(JSON.parse(data));
  };

  // 2. 保存機能
  const saveWord = async () => {
    const newList = [...list, { word, meaning }];
    setList(newList);
    await AsyncStorage.setItem('myWords', JSON.stringify(newList));
    alert('保存しました！');
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="単語" onChangeText={setWord} />
      <TextInput style={styles.input} placeholder="意味" onChangeText={setMeaning} />
      <Button title="保存する" onPress={saveWord} />
      
      <Text style={styles.title}>保存されたリスト:</Text>
      <FlatList
        data={list}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.item}>{item.word}: {item.meaning}</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 40, marginTop: 50 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10 },
  title: { fontSize: 18, marginTop: 20, fontWeight: 'bold' },
  item: { fontSize: 16, padding: 5, borderBottomWidth: 1, borderBottomColor: '#eee' }
});
