import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() { 
    return (
        <View style={style.container}>
            
            {/* アプリ名 */}
            <View style={style.Titlecontainer}>
                <Ionicons name="book-outline" size={36} color="#1A365D" style={style.TitleIcon} />
                <Text style={style.TitleText}>ReadLens</Text>
            </View>

        
            <View style={style.middleBadge}>
                <Text style={style.badgeText}>読</Text>
                <Ionicons name="search-outline" size={28} color="#8C7654" style={style.badgeIcon} />
                <Text style={style.badgeText}>知</Text>
            </View>
            
            {/* カメラボタン */}
            <TouchableOpacity style={style.button} onPress={() => router.push('/camera')}>
                <Text style={style.buttonText}>カメラ</Text>
            </TouchableOpacity>

            {/* メモボタン */}
            <TouchableOpacity style={style.button} onPress={() => router.push('/explore')}>
                <Text style={style.buttonText}>メモ</Text>
            </TouchableOpacity>

          
            <View style={style.descriptionBox}>
                <Text style={style.descriptionText}>
                    読書を深めるレンズ。カメラで言葉をすくい上げ、あなたの知識に。
                </Text>
            </View>

        </View>
    );
}

const style = StyleSheet.create({
    container: {
        flex: 1,
        width:'100%',
        backgroundColor: '#F7F4EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    Titlecontainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    TitleIcon: {
        marginRight: 10
    },
    TitleText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#1A365D',
    },
    //真ん中のマークのスタイル
    middleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40, 
    },
    badgeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#8C7654', 
    },
    badgeIcon: {
        marginHorizontal: 6, 
    },
    button: {
        backgroundColor: '#2B6CB0',
        padding: 18,
        width: 300,
        borderRadius: 12,
        marginBottom: 20,
        
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5
    },
    buttonText: {
       textAlign: 'center',
       fontSize: 30, 
       fontWeight: 'bold',
       color: '#fff'
    },
  
    descriptionBox: {
        backgroundColor: '#EAE5D8', 
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 20,
        marginTop: 30,
        width: '80%', 
    },
    descriptionText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        lineHeight: 22, 
    },
});