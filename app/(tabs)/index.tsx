import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export default function HomeScreen() { 
    return(
        <View style={style.container}>
            <TouchableOpacity style={style.button} onPress={()=>router.push('/camera')}>
                <Text style={style.buttonText}>カメラ画面へ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={style.button} onPress={()=>router.push('/explore')}>
                <Text style={style.buttonText}>メモ画面へ</Text>

            </TouchableOpacity>
        </View>
    )
 
}

const style=StyleSheet.create({
    container:{
        flex:1,
        backgroundColor:'#fff',
        justifyContent:'center',
        alignItems:'center',
    },
    button:{
        backgroundColor:'#007aff',
        padding:15,
        width:200,
        borderRadius:10,
        marginBottom:15,
        
    },
    buttonText:{
       
    }
})