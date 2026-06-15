import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useMemo, useRef, useState } from 'react';
import { Button, LayoutChangeEvent, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null); // カメラを操作するための参照

  // スキャン枠の座標とサイズ
  const [box, setBox] = useState({ top: 100, left: 100, width: 150, height: 150 });
  // コンテナのサイズ（onLayoutで取得）
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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

  // 撮影処理
  const takePicture = async () => {
    if (!cameraRef.current||containerSize.width === 0) return;
    try{
      const photo = await cameraRef.current.takePictureAsync();
      
      // 撮影された実際の画像サイズと、画面の表示サイズから倍率を計算
      const scaleX=photo.width/containerSize.width;
      const scaleY=photo.height/containerSize.height;

      //画面上のスキャン枠の位置とサイズを実際のが画像サイズに変更
      const originX=box.left*scaleX;
      const originY=box.top*scaleY;
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
         console.log('切り抜き成功！画像URI:', croppedPhoto.uri);
         alert('枠の中だけを切り抜いて保存しました！');

    }catch(error){
      console.error('切り抜き失敗:', error);
      alert('エラーが発生しました');
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

      {/* 撮影ボタン */}
      <View style={styles.buttonContainer}>
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
});