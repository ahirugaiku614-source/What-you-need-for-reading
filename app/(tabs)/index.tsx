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
  const [box, setBox] = useState({ top: 100, left: 100, width: 150, height: 150 });
  // コンテナのサイズ（onLayoutで取得）
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  //日本語ウィクショナリーAPIを使って、日本語の意味と読みを取得する関数
  const handleExtractedText = async (text: string) => {
  // 空白や改行をキレイにする
  const cleanedText = text.replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, '').trim();

  console.log('--- 辞書に送る直前の文字はこれです：', `"${cleanedText}"`);

  // 文章抽出モードの場合は、検索せずにそのまま終了
  if (currentMode === 'text') {
    alert(`【文章の抜き取り】\n${cleanedText}`);
    return;
  }

  try{
     const url = `https://ja.wiktionary.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(cleanedText)}&format=json&origin=*&redirects=1`;
     const response = await fetch(url);
     const json = await response.json();

       // 検索結果の一番最初（最も一致するもの）を取得
      const pages = json.query?.pages;

      if (!pages) {
      alert(`「${cleanedText}」に一致する辞書データが見つかりませんでした。`);
      return;
      }
      //ランダムなページAPIキーから中身を取り出す
      const pageId = Object.keys(pages)[0];
      const rawExtract = pages[pageId]?.extract;

      // 該当するページがない、または中身が空の場合
    if (pageId === '-1' || !rawExtract) {
      alert(`「${cleanedText}」は辞書に見つかりませんでした。単語のみで撮影してみてください。`);
      return;
    }
    //不要な文字や改行を消去
    let cleanExtract = rawExtract.trim();

    //モードごとに表示を切り替え
    if (currentMode === 'kanji') {
      // ✍️ 漢字の読み方モード
      // ウィクショナリーのテキストから「ひらがな」の読み部分を見つける簡易的な処理
      // （※ページ冒頭の「カタカナ」や「ひらがな」の記述を引っ掛けます）
      const readingMatch = cleanExtract.match(/（([^）]+)）/) || cleanExtract.match(/【([^】]+)】/);
      const possibleReading = readingMatch ? readingMatch[1] : 'テキストから読みを特定できませんでした';

      alert(`✍️ 漢字の読み方結果\n\n【単語】${cleanedText}\n【解説内の推測読み】${possibleReading}\n\n※下の詳細解説も参考にしてください:\n${cleanExtract.substring(0, 100)}...`);
      
    } else if (currentMode === 'meaning') {
      // 📚 意味検索モード（日本語でドンと表示！）
      // 文字数が長すぎる場合は、アラートで見やすいように少し短くカットします
      const displayMeaning = cleanExtract.length > 300 
        ? cleanExtract.substring(0, 300) + '...（省略）' 
        : cleanExtract;

      alert(`📚 言葉の意味検索結果\n\n対象：${cleanedText}\n\n${displayMeaning}`);
    }
  }catch(error){
    console.error('辞書検索エラー:', error);
    alert('辞書データの取得中にエラーが発生しました。');
  }
  };

  // 最新状態を保持するRef（PanResponder内のクロージャ対策）
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
      const boxWidth = 200;
      const boxHeight = 200;
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
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
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
      <CameraView style={StyleSheet.absoluteFill} facing="back" ref={cameraRef} />

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

        {/* 💡 コントロール領域（切り替えタブ ＋ 撮影ボタン） */}
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
});