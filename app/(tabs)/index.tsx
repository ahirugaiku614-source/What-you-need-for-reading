import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useMemo, useRef, useState } from 'react';
import { Button, LayoutChangeEvent, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null); // カメラを操作するための参照
  // 現在のモード（meanign=単語帳用、kanji=漢字用、text=メモ用）
  const [currentMode, setCurrenMode] = useState<'meaning' | 'kanji' | 'text'>('text');
  // スキャン枠の座標とサイズ
 const [box, setBox] = useState({ top: 150, left: 150, width: 50, height: 50 });
  // コンテナのサイズ（onLayoutで取得）
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  //メッセージボードを表示するかどうかの管理（初期値は true = 表示する）
  const [showGuide, setShowGuide] = useState(true);

  //ズーム倍率管理
  const [zoom, setZoom] = useState(0);

  //Wikipedia REST APIを使って、日本語の意味を取得する関数
  const handleExtractedText = async (text: string) => {
  // 空白や改行をキレイにする
  const cleanedText = text.replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, '').trim();

  console.log(' 辞書に送る直前の文字はこれです：', `"${cleanedText}"`);

  // 文章抽出モードの場合は、検索せずにそのまま終了
  if (currentMode === 'text') {
    try {
      const newMemo = {
        id: Date.now().toString(),
        word: "（文章抽出）", // 画面で見分けるためのラベル
        reading: "---",       // 文章なので読み方はなし
        meaning: cleanedText,  // 抜き出した文章をセット
        createdAt: new Date().toLocaleDateString('ja-JP'),
      };

      // 端末の既存データを読み込んで合体
      const existingMemosJson = await AsyncStorage.getItem('dictionary_memos');
      const existingMemos = existingMemosJson ? JSON.parse(existingMemosJson) : [];
      const updatedMemos = [newMemo, ...existingMemos];

      await AsyncStorage.setItem('dictionary_memos', JSON.stringify(updatedMemos));

      alert(`【文章の抜き取り】\nexplore画面に保存しました！\n\n${cleanedText}`);
      return;
    } catch (error) {
      console.error('保存エラー:', error);
      alert('文章の保存に失敗しました。');
      return;
    }
  }

  //漢字の読み仮名取得ではYahoo関数に飛ぶ
  if(currentMode=='kanji'){
    console.log('Yahoo Web APIを使用して読みを取得します');
    await getReadingFromYahoo(cleanedText);
    return;
  }

 try {

    // Wikipedia REST API のsummaryエンドポイントを使用
    
    const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanedText)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyDictionaryApp/1.0 (contact: example@example.com)' // Wikipedia APIのマナーとしてUser-Agentを設定
      }
    });

    // 該当するページがWikipediaに存在しない場合（404エラーなど）
    if (!response.ok) {
      alert(`「${cleanedText}」に一致する記事がWikipediaで見つかりませんでした。GeminiAPIに切り替えます`);
      await callGeminiFallback(cleanedText);
      return;
    }

    const json = await response.json();

    // プレーンテキストの要約を引き抜き
    const extract = json.extract;

    if (!extract) {
      alert(`「${cleanedText}」の要約データを取得できませんでした。GeminiAPIに切り替えます`);
      await callGeminiFallback(cleanedText);
      return;
    }
    let possibleReading="---"
    // モードごとに表示を切り替え

      
   if (currentMode === 'meaning') {
      //  意味検索モード
      alert(`Wikipediaによる言葉の概要\n\n対象：${cleanedText}\n\n${extract}`);
    }

    const newMemo={
      id:Date.now().toString(), //消去するとき用のID
      word:cleanedText,
      reading:possibleReading,
      meaning:extract,
      createdAt: new Date().toLocaleDateString('ja-JP'),
    };

    const existingMemosJson = await AsyncStorage.getItem('dictionary_memos');
    const existingMemos = existingMemosJson ? JSON.parse(existingMemosJson) : [];
    const updatedMemos = [newMemo, ...existingMemos]; // 新しいものを一番上に

    await AsyncStorage.setItem('dictionary_memos', JSON.stringify(updatedMemos));


   if (currentMode === 'meaning') {
      alert(`言葉の意味（Memo画面に保存しました）\n\n対象：${cleanedText}\n\n${extract}`);
    }

    return

  } catch (error) {
    console.error('Wikipedia REST API検索エラー:', error);
    alert('Wikipediaデータの取得中にエラーが発生しました。');
  }
}

//読み仮名取得用のYahooWebAPI関数
const getReadingFromYahoo=async(cleanedText:String)=> {
  const YAHOO_CLIENT_ID = process.env.EXPO_PUBLIC_YAHOO_CLIENT_ID;

  const url = 'https://jlp.yahooapis.jp/FuriganaService/V2/furigana';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Yahoo AppID: ${YAHOO_CLIENT_ID}`,
      },
      body: JSON.stringify({
        id: "1234-1",
        jsonrpc: "2.0",
        method: "jlp.furiganaservice.furigana",
        params: {
          q: cleanedText,
          grade: 1 // 1年生以上の漢字すべてにルビを振る
        }
      })
    });

    if (!response.ok){
      await callGeminiFallback(cleanedText);
      return;
    }

    const json = await response.json();
    const words = json.result?.word;
    
    if (!words){
      await callGeminiFallback(cleanedText);
      return;
    }

    let fullReading="";
    for(const w of words){    //YahooのAPIから送られてくる形態素を繋げふりがなを作成する
      fullReading+=w.furigana||w.surface;
    }

    const newMemo = {
      id: Date.now().toString(),
      word: cleanedText,
      reading: fullReading,
      meaning: "---",
      createdAt: new Date().toLocaleDateString('ja-JP'),
    };

    alert(`漢字の読み方（Memo画面に保存しました）\n\n【単語】${cleanedText}\n【読み】${fullReading}\n`)
    const existingMemosJson = await AsyncStorage.getItem('dictionary_memos');
    const existingMemos = existingMemosJson ? JSON.parse(existingMemosJson) : [];
    await AsyncStorage.setItem('dictionary_memos', JSON.stringify([newMemo, ...existingMemos]));


  }catch(error){
    console.error('Yahoo! API エラー:', error);
    await callGeminiFallback(cleanedText);
  }
};

//データが見つからなかった際のバックアップで使用するGeminiAPI関数
const callGeminiFallback=async(cleanedText:String)=>{
  console.log("Wikiにデータが無かったため、GeminiAPIを呼び出し")
  const GEMINI_KEY=process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  let prompt="";
  if(currentMode=='meaning'){
    prompt=`あなたは優秀な日本語辞書です。「${cleanedText}」という言葉の意味や概要を短く分かりやすくまとめて下さい。前置き（「はい、お答えします」など）や見出し記号は一切含めず、一つの説明文章として出力してください。`
  }
  else if(currentMode=='kanji'){
    prompt=`「${cleanedText}」という漢字の読み仮名をひらがなのみで答えてください。前置き（「はい、お答えします」など）や見出し記号は一切含めず、一つの説明文章として出力してください。`
  }

  try{
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

    const geminiJson = await geminiResponse.json();
    const aiResponse = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!aiResponse) {
      alert(`「${cleanedText}」のデータをAIから取得できませんでした。`);
      return;
    }

    // 保存用データの仕分け
    let possibleReading = '---';
    let finalMeaning = '';

    if (currentMode === 'meaning') {
      finalMeaning = aiResponse; // Geminiが作った分かりやすい意味
    } else if (currentMode === 'kanji') {
      possibleReading = aiResponse; // Geminiが作ったひらがなの読み方
      finalMeaning = '（AI読み方モードで取得されました）';
    }

    //AsyncStorageにデータを保存する
    const newMemo = {
      id: Date.now().toString(),
      word: cleanedText,
      reading: possibleReading,
      meaning: finalMeaning,
      createdAt: new Date().toLocaleDateString('ja-JP'),
    };

    const existingMemosJson = await AsyncStorage.getItem('dictionary_memos');
    const existingMemos = existingMemosJson ? JSON.parse(existingMemosJson) : [];
    await AsyncStorage.setItem('dictionary_memos', JSON.stringify([newMemo, ...existingMemos]));

     if (currentMode === 'kanji') {
      alert(` 漢字の読み方（Memo画面に保存しました）\n\n【単語】${cleanedText}\n【読み】${possibleReading}`);
    } else if (currentMode === 'meaning') {
      alert(`言葉の意味（Memo画面に保存しました）\n\n対象：${cleanedText}\n\n${finalMeaning}`);
    }

    return;

  }catch(geminiError){
    console.error('Gemini API 実行エラー:', geminiError);
    alert('AIの検索中にエラーが発生しました。');
  }
}

  // 最新状態を保持するRef
  const boxRef = useRef(box);
  boxRef.current = box;
  const containerSizeRef = useRef(containerSize);
  containerSizeRef.current = containerSize;

  const dragStartBox = useRef({ top: 0, left: 0, width: 0, height: 0 });
  const isInitialized = useRef(false);

  // コンテナサイズ取得時に枠を中央に配置する
  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
    if (!isInitialized.current && width > 0 && height > 0) {
      const boxWidth = 60;
      const boxHeight = 60;
      setBox({
        top: (height - boxHeight) / 2,
        left: (width - boxWidth) / 2,
        width: boxWidth,
        height: boxHeight,
      });
      isInitialized.current = true;
    }
  };

  // 各ハンドル共通のPanResponder生成関数
  const createPanResponder = (type: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartBox.current = { ...boxRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        const initial = dragStartBox.current;
        const { dx, dy } = gestureState;
        const container = containerSizeRef.current;
        const minSize = 80;

        let newTop = initial.top;
        let newLeft = initial.left;
        let newWidth = initial.width;
        let newHeight = initial.height;

        if (type === 'tl') {
          const rightLimit = initial.left + initial.width;
          const bottomLimit = initial.top + initial.height;
          newLeft = Math.max(0, Math.min(initial.left + dx, rightLimit - minSize));
          newTop = Math.max(0, Math.min(initial.top + dy, bottomLimit - minSize));
          newWidth = rightLimit - newLeft;
          newHeight = bottomLimit - newTop;
        } else if (type === 'tr') {
          const bottomLimit = initial.top + initial.height;
          newTop = Math.max(0, Math.min(initial.top + dy, bottomLimit - minSize));
          newWidth = Math.max(minSize, Math.min(initial.width + dx, container.width - initial.left));
          newHeight = bottomLimit - newTop;
        } else if (type === 'bl') {
          const rightLimit = initial.left + initial.width;
          newLeft = Math.max(0, Math.min(initial.left + dx, rightLimit - minSize));
          newWidth = rightLimit - newLeft;
          newHeight = Math.max(minSize, Math.min(initial.height + dy, container.height - initial.top));
        } else if (type === 'br') {
          newWidth = Math.max(minSize, Math.min(initial.width + dx, container.width - initial.left));
          newHeight = Math.max(minSize, Math.min(initial.height + dy, container.height - initial.top));
        } else if (type === 't') {
          const bottomLimit = initial.top + initial.height;
          newTop = Math.max(0, Math.min(initial.top + dy, bottomLimit - minSize));
          newHeight = bottomLimit - newTop;
        } else if (type === 'b') {
          newHeight = Math.max(minSize, Math.min(initial.height + dy, container.height - initial.top));
        } else if (type === 'l') {
          const rightLimit = initial.left + initial.width;
          newLeft = Math.max(0, Math.min(initial.left + dx, rightLimit - minSize));
          newWidth = rightLimit - newLeft;
        } else if (type === 'r') {
          newWidth = Math.max(minSize, Math.min(initial.width + dx, container.width - initial.left));
        }

        setBox({
          top: newTop,
          left: newLeft,
          width: newWidth,
          height: newHeight,
        });
      },
    });
  };

  // stableなPanResponderオブジェクトを生成
  const responders = useMemo(() => {
    return {
      tl: createPanResponder('tl'),
      tr: createPanResponder('tr'),
      bl: createPanResponder('bl'),
      br: createPanResponder('br'),
      t: createPanResponder('t'),
      b: createPanResponder('b'),
      l: createPanResponder('l'),
      r: createPanResponder('r'),
    };
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Button title="カメラを許可" onPress={requestPermission} />
      </View>
    );
  }

  //文字認識関数
  const recognizeTextFromImage = async (base64str: string): Promise<string> => {
    // ここでOCRライブラリやAPIを呼び出す
    const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY}`;
    
   const response=await fetch(url,{
    method:'POST',
    headers:{'Content-Type': 'application/json'},
    body:JSON.stringify({
      requests:[
        {
          image:{content: base64str},
          features: [{ type: 'TEXT_DETECTION' }], // 文字認識（OCR）を指定
          imageContext: { languageHints: ['ja'] }, // 日本語を優先的に読ませる
        },
      ],
    }),
   });
   const json = await response.json();
  
  // Googleから返ってきたデータから、読み取れた文章を取り出す
 const detectedText = json.responses?.[0]?.fullTextAnnotation?.text;
  if (!detectedText) {
    throw new Error('文字が検出されませんでした。');
  }

  return detectedText;
 };



  // 撮影処理
  const takePicture = async () => {
    if (!cameraRef.current || containerSize.width === 0) return;
    let croppedPhotoUri: string | null = null;
    try {
      //写真撮影
      const photo = await cameraRef.current.takePictureAsync();
      //写真そのもののサイズを取得
      const photoWidth = photo.width;
      const photoHeight = photo.height;

      // 撮影された実際の画像サイズと、画面の表示サイズから倍率を計算
      const scaleX = photoWidth / containerSize.width;
　　  const scaleY = photoHeight / containerSize.height;

      //画面上のスキャン枠の位置とサイズを実際の画像サイズに変更
      const originX = box.left * scaleX;
      const originY = box.top * scaleY;
      const cropWidth = box.width * scaleX;
      const cropHeight = box.height * scaleY;

      const croppedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          {
            crop: {
              originX: originX,
              originY: originY,
              width: cropWidth,
              height: cropHeight,
            },
          },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      //画像保存
      croppedPhotoUri = croppedPhoto.uri;
      console.log('切り抜き画像(一時保存):', croppedPhotoUri);
      //画像データをbase64として読み込む
      const base64Image = await FileSystem.readAsStringAsync(croppedPhoto.uri, { encoding: FileSystem.EncodingType.Base64 });

      // 元の全画面写真を削除してメモリを開放
      await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => { });

      //切り抜いた画像から文字の抜き出し
      alert('文字を認識中...');
      const extractedText = await recognizeTextFromImage(base64Image);

      console.log('文字の抜き出しに成功しました！:', extractedText);
      await handleExtractedText(extractedText);


    } catch (error) {
      console.error('切り抜き失敗:', error);
      alert('エラーが発生しました');
    } finally {
      //メモリリーク防止のため、撮影直後に一時保存した画像を削除
      if (croppedPhotoUri) {
        try {
          await FileSystem.deleteAsync(croppedPhotoUri, { idempotent: true }).catch(() => { });
          console.log('切り抜き画像を完全削除');
        } catch (deleteError) {
          console.error('画像削除エラー:', deleteError);
        }
      }
    }


  };

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} zoom={zoom}/>
      {showGuide && (
        <View style={styles.guideContainer}>
          <Text style={styles.guideText}>
            カメラ枠の中に抜き取りたい文章、または意味・読みを知りたい文字を入れて撮影してください。
          </Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => setShowGuide(false)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* スキャン範囲のマスク */}
      <View style={styles.maskContainer} onLayout={onContainerLayout}>
        {containerSize.width > 0 && (
          <>
            {/* 1. 上側の黒いマスク */}
            <View
              style={[
                styles.mask,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: box.top,
                },
              ]}
            />

            {/* 2. 下側の黒いマスク */}
            <View
              style={[
                styles.mask,
                {
                  position: 'absolute',
                  top: box.top + box.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
              ]}
            />

            {/* 3. 左側の黒いマスク */}
            <View
              style={[
                styles.mask,
                {
                  position: 'absolute',
                  top: box.top,
                  left: 0,
                  width: box.left,
                  height: box.height,
                },
              ]}
            />

            {/* 4. 右側の黒いマスク */}
            <View
              style={[
                styles.mask,
                {
                  position: 'absolute',
                  top: box.top,
                  left: box.left + box.width,
                  right: 0,
                  height: box.height,
                },
              ]}
            />

            {/* 中央の透明な枠 */}
            <View
              style={[
                styles.transparentFrame,
                {
                  position: 'absolute',
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                },
              ]}
            />

            {/* 中央の領域にはドラッグ用のPanResponderをアタッチしない */}

            {/* 辺のドラッグ領域 */}
            {/* 上辺 */}
            <View
              style={[
                styles.edgeTouchable,
                {
                  position: 'absolute',
                  top: box.top - 20,
                  left: box.left + 20,
                  width: box.width - 40,
                  height: 40,
                },
              ]}
              {...responders.t.panHandlers}
            />
            {/* 下辺 */}
            <View
              style={[
                styles.edgeTouchable,
                {
                  position: 'absolute',
                  top: box.top + box.height - 20,
                  left: box.left + 20,
                  width: box.width - 40,
                  height: 40,
                },
              ]}
              {...responders.b.panHandlers}
            />
            {/* 左辺 */}
            <View
              style={[
                styles.edgeTouchable,
                {
                  position: 'absolute',
                  top: box.top + 20,
                  left: box.left - 20,
                  width: 40,
                  height: box.height - 40,
                },
              ]}
              {...responders.l.panHandlers}
            />
            {/* 右辺 */}
            <View
              style={[
                styles.edgeTouchable,
                {
                  position: 'absolute',
                  top: box.top + 20,
                  left: box.left + box.width - 20,
                  width: 40,
                  height: box.height - 40,
                },
              ]}
              {...responders.r.panHandlers}
            />

            {/* 角のハンドル（L字の見た目とタッチ領域） */}
            {/* 左上 */}
            <View
              style={[
                styles.handleTouchable,
                {
                  position: 'absolute',
                  top: box.top - 20,
                  left: box.left - 20,
                },
              ]}
              {...responders.tl.panHandlers}
            >
              <View
                style={[
                  styles.cornerVisual,
                  {
                    top: 20,
                    left: 20,
                    borderTopWidth: 4,
                    borderLeftWidth: 4,
                  },
                ]}
              />
            </View>

            {/* 右上 */}
            <View
              style={[
                styles.handleTouchable,
                {
                  position: 'absolute',
                  top: box.top - 20,
                  left: box.left + box.width - 20,
                },
              ]}
              {...responders.tr.panHandlers}
            >
              <View
                style={[
                  styles.cornerVisual,
                  {
                    top: 20,
                    right: 20,
                    borderTopWidth: 4,
                    borderRightWidth: 4,
                  },
                ]}
              />
            </View>

            {/* 左下 */}
            <View
              style={[
                styles.handleTouchable,
                {
                  position: 'absolute',
                  top: box.top + box.height - 20,
                  left: box.left - 20,
                },
              ]}
              {...responders.bl.panHandlers}
            >
              <View
                style={[
                  styles.cornerVisual,
                  {
                    bottom: 20,
                    left: 20,
                    borderBottomWidth: 4,
                    borderLeftWidth: 4,
                  },
                ]}
              />
            </View>

            {/* 右下 */}
            <View
              style={[
                styles.handleTouchable,
                {
                  position: 'absolute',
                  top: box.top + box.height - 20,
                  left: box.left + box.width - 20,
                },
              ]}
              {...responders.br.panHandlers}
            >
              <View
                style={[
                  styles.cornerVisual,
                  {
                    bottom: 20,
                    right: 20,
                    borderBottomWidth: 4,
                    borderRightWidth: 4,
                  },
                ]}
              />
            </View>
          </>
        )}
      </View>

        {/* コントロール領域（切り替えタブ ＋ 撮影ボタン） */}
      <View style={styles.controlsContainer} pointerEvents="box-none">
        {/* モード選択タブ */}
        <View style={styles.modeSelector}>
          <TouchableOpacity 
            style={[styles.modeButton, currentMode === 'meaning' && styles.activeModeButton]} 
            onPress={() => setCurrenMode('meaning')}
          >
            <Text style={[styles.modeText, currentMode === 'meaning' && styles.activeModeText]}>意味検索</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modeButton, currentMode === 'kanji' && styles.activeModeButton]} 
            onPress={() => setCurrenMode('kanji')}
          >
            <Text style={[styles.modeText, currentMode === 'kanji' && styles.activeModeText]}>漢字の読み</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modeButton, currentMode === 'text' && styles.activeModeButton]} 
            onPress={() => setCurrenMode('text')}
          >
            <Text style={[styles.modeText, currentMode === 'text' && styles.activeModeText]}>文章抽出</Text>
          </TouchableOpacity>
        </View>
        {/*カメラ倍率変更スライドバー*/}
　　　　　<View style={styles.sliderWrapper}>
          <Text style={styles.sliderLabel}>🔍 1x</Text>
          <View 
            style={styles.sliderContainer}
            // スライダー全体の領域でタッチを感知するように親要素に設定
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderMove={(e) => {
              //sliderContainerの左端からの位置を取得
              const touchX = e.nativeEvent.locationX;
              // 160px の幅に対して、どこに指があるかを 0 〜 1 で計算
              const progress = Math.max(0, Math.min(1, touchX / 160));
              // 0 から 0.3 の間でズームを滑らかに変化
              setZoom(progress * 0.3);
            }}
          >
            {/* スライダーのベースの線 */}
            <View style={styles.sliderLine} pointerEvents="none" />
            
            {/* 動くつまみ */}
            <View 
              style={[
                styles.sliderThumb, 
                { left: `${(zoom / 0.3) * 100}%` }
              ]}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              pointerEvents="none" //つまみ自身がタッチイベントを吸い取らないようにしてブレを防ぐ
            />
          </View>
          <Text style={styles.sliderLabel}>🔎 3x</Text>
        </View>

        {/* 撮影ボタン */}
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  maskContainer: { flex: 1, backgroundColor: 'transparent' },

  // マスク（半透明）
  mask: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // 中央の透明な枠（ドロップシャドウ付き）
  transparentFrame: {
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },

  // ドラッグ操作用のタッチエリア
  handleTouchable: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  edgeTouchable: {
    backgroundColor: 'transparent',
    zIndex: 9,
  },


  // 角のL字マーク（高視認性ネオングリーン＋シャドウ）
  cornerVisual: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#00E676',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 3,
  },

  // ボタンの配置
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    zIndex: 20,
  },

  captureButton: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
  },
  captureButtonInner: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, borderColor: 'black',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  activeModeButton: {
    backgroundColor: '#00E676', // 選択中のモードはネオングリーンにする
  },
  modeText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeModeText: {
    color: 'black', // 選択中は黒文字で見やすく
  },
  guideContainer: {
    position: 'absolute',
    top: 60,                // 画面上部からの位置（ステータスバーを避ける高さ）
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', // 黒の65%半透明（薄く透ける背景）
    borderRadius: 12,       // 角丸
    paddingVertical: 12,
    paddingHorizontal: 40,  // バツボタンと被らないように右側広め
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 30,             // スキャン枠よりも手前に表示
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -15,         // 中央配置の調整
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#aaaaaa',       // 少し薄いグレーのバツ印
    fontSize: 24,
    fontWeight: 'bold',
  },

  sliderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 15, // 撮影ボタンとの間隔
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sliderLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    width: 35,
    textAlign: 'center',
  },
  sliderContainer: {
    width: 160, // スライダーの横幅
    height: 30, // タッチしやすいように縦幅を高めにする
    justifyContent: 'center',
    marginHorizontal: 10,
    position: 'relative',
  },
  sliderLine: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // 薄い白の線
    borderRadius: 2,
    width: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00E676', // 枠線と同じ視認性の高いネオングリーン
    marginLeft: -10, // つまみの中心を合わせるための調整
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
});